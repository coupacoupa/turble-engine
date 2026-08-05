import { create } from "@bufbuild/protobuf";
import {
  Code,
  ConnectError,
  type HandlerContext,
  type ServiceImpl,
} from "@connectrpc/connect";
import jsonpatch from "fast-json-patch";
import { and, desc, eq, isNull, like, lt, ne } from "drizzle-orm";
import { kUser, type AuthUser } from "@/interceptors/auth.interceptor";
import { db } from "@repo/db";
import {
  workflowDependencies,
  workflowEvents,
  workflows,
  workflowTestCases,
  workflowVersions,
  type Workflow,
  type WorkflowTestCase,
  type WorkflowVersion,
} from "@repo/db/schema";
import type { MatrixSchema } from "@repo/engine";
import {
  CreateWorkflowResponseSchema,
  DeleteTestCaseResponseSchema,
  DeleteWorkflowResponseSchema,
  GetVersionResponseSchema,
  GetWorkflowResponseSchema,
  ListEventsResponseSchema,
  ListTestCasesResponseSchema,
  ListVersionsResponseSchema,
  ListWorkflowsResponseSchema,
  PublishVersionResponseSchema,
  SaveDraftResponseSchema,
  SaveTestCaseResponseSchema,
  WorkflowService,
} from "@repo/proto";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUser(ctx: HandlerContext): AuthUser {
  const user = ctx.values.get(kUser);
  if (!user) {
    throw new ConnectError("authentication required", Code.Unauthenticated);
  }
  return user;
}

/** Parse and structurally validate an incoming MatrixSchema JSON document. */
function parseDefinition(json: string): MatrixSchema {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ConnectError(
      "definition_json is not valid JSON",
      Code.InvalidArgument,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConnectError(
      "definition_json must be a MatrixSchema object",
      Code.InvalidArgument,
    );
  }
  const def = parsed as Record<string, unknown>;
  if (
    typeof def.name !== "string" ||
    !Array.isArray(def.columns) ||
    !Array.isArray(def.rows) ||
    typeof def.cells !== "object" ||
    def.cells === null ||
    Array.isArray(def.cells)
  ) {
    throw new ConnectError(
      "definition_json is missing required MatrixSchema fields (name, columns, rows, cells)",
      Code.InvalidArgument,
    );
  }
  return def as unknown as MatrixSchema;
}

interface DependencyPin {
  targetWorkflowId: string;
  targetVersionNumber: number;
}

/**
 * Extract sub-workflow pins from a definition. Only UUID references are
 * returned (legacy string ids cannot exist in the DB); an unpinned reference
 * yields version 0, which publish validation rejects.
 */
function extractDependencies(definition: MatrixSchema): DependencyPin[] {
  const seen = new Map<string, DependencyPin>();
  for (const row of definition.rows ?? []) {
    if (row.type !== "workflow" || !row.subWorkflowId) continue;
    if (!UUID_RE.test(row.subWorkflowId)) continue;
    const pin: DependencyPin = {
      targetWorkflowId: row.subWorkflowId,
      targetVersionNumber: row.subWorkflowVersion ?? 0,
    };
    seen.set(`${pin.targetWorkflowId}:${pin.targetVersionNumber}`, pin);
  }
  return [...seen.values()];
}

function isUniqueViolation(err: unknown): boolean {
  const code =
    (err as { code?: string })?.code ??
    (err as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

async function getOwnedWorkflow(
  workflowId: string,
  ownerId: string,
): Promise<Workflow> {
  if (!UUID_RE.test(workflowId)) {
    throw new ConnectError("workflow not found", Code.NotFound);
  }
  const [row] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, workflowId), eq(workflows.ownerId, ownerId)))
    .limit(1);
  if (!row) {
    throw new ConnectError("workflow not found", Code.NotFound);
  }
  return row;
}

function recordEvent(
  workflowId: string,
  actorId: string,
  eventType: string,
  payload: unknown,
) {
  return db.insert(workflowEvents).values({
    workflowId,
    actorId,
    eventType,
    payload,
  });
}

const toMs = (d: Date) => BigInt(d.getTime());

function toWorkflowProto(row: Workflow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    latestVersion: row.latestVersion,
    draftDefinitionJson: JSON.stringify(row.draftDefinition),
    createdAtMs: toMs(row.createdAt),
    updatedAtMs: toMs(row.updatedAt),
  };
}

function toVersionProto(row: WorkflowVersion) {
  return {
    id: row.id,
    workflowId: row.workflowId,
    versionNumber: row.versionNumber,
    definitionJson: JSON.stringify(row.definition),
    label: row.label ?? "",
    notes: row.notes ?? "",
    publishedAtMs: toMs(row.publishedAt),
  };
}

function toTestCaseProto(row: WorkflowTestCase) {
  return {
    id: row.id,
    workflowId: row.workflowId,
    name: row.name,
    description: row.description,
    inputsJson: JSON.stringify(row.inputs),
    expectedJson: JSON.stringify(row.expected),
    createdAtMs: toMs(row.createdAt),
    updatedAtMs: toMs(row.updatedAt),
  };
}

/** Service implementation for Connect-RPC WorkflowService (owner-scoped). */
export const workflowHandler: ServiceImpl<typeof WorkflowService> = {
  async listWorkflows(_req, ctx) {
    const user = requireUser(ctx);
    const rows = await db
      .select()
      .from(workflows)
      .where(eq(workflows.ownerId, user.id))
      .orderBy(desc(workflows.updatedAt));

    return create(ListWorkflowsResponseSchema, {
      workflows: rows.map((row) => {
        const def = row.draftDefinition as MatrixSchema;
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          latestVersion: row.latestVersion,
          columnCount: def.columns?.length ?? 0,
          rowCount: def.rows?.length ?? 0,
          createdAtMs: toMs(row.createdAt),
          updatedAtMs: toMs(row.updatedAt),
        };
      }),
    });
  },

  async getWorkflow(req, ctx) {
    const user = requireUser(ctx);
    const row = await getOwnedWorkflow(req.workflowId, user.id);
    return create(GetWorkflowResponseSchema, {
      workflow: toWorkflowProto(row),
    });
  },

  async createWorkflow(req, ctx) {
    const user = requireUser(ctx);
    const id = crypto.randomUUID();

    const definition: MatrixSchema = req.definitionJson
      ? parseDefinition(req.definitionJson)
      : {
          id,
          name: req.name || "Untitled Matrix Workflow",
          description: req.description ?? "",
          columns: [],
          rows: [],
          cells: {},
        };
    // The DB row id is the canonical workflow id — keep the blob consistent.
    definition.id = id;
    if (req.name) definition.name = req.name;
    if (req.description) definition.description = req.description;

    // Auto-suffix duplicate names ("Foo", "Foo (2)", ...) so repeated
    // "create new" clicks never trip the per-owner unique name index.
    let name = definition.name.trim() || "Untitled Matrix Workflow";
    const siblings = await db
      .select({ name: workflows.name })
      .from(workflows)
      .where(
        and(eq(workflows.ownerId, user.id), like(workflows.name, `${name}%`)),
      );
    if (siblings.some((s) => s.name === name)) {
      const taken = new Set(siblings.map((s) => s.name));
      let n = 2;
      while (taken.has(`${name} (${n})`)) n++;
      name = `${name} (${n})`;
    }
    definition.name = name;
    const description = definition.description ?? "";

    let inserted: Workflow | undefined;
    try {
      [inserted] = await db
        .insert(workflows)
        .values({
          id,
          ownerId: user.id,
          name,
          description,
          draftDefinition: definition,
        })
        .returning();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConnectError(
          `a workflow named "${name}" already exists`,
          Code.AlreadyExists,
        );
      }
      throw err;
    }
    if (!inserted) {
      throw new ConnectError("failed to create workflow", Code.Internal);
    }

    await recordEvent(id, user.id, "created", { name });

    return create(CreateWorkflowResponseSchema, {
      workflow: toWorkflowProto(inserted),
    });
  },

  async saveDraft(req, ctx) {
    const user = requireUser(ctx);
    const existing = await getOwnedWorkflow(req.workflowId, user.id);

    const definition = parseDefinition(req.definitionJson);
    definition.id = existing.id;
    const name = definition.name.trim() || existing.name;
    definition.name = name;
    const description = definition.description ?? "";

    // Server-side diff: the audit trail is computed from what is actually
    // stored, in the same request that stores it — it cannot drift.
    const patch = jsonpatch.compare(
      existing.draftDefinition as object,
      definition as unknown as object,
    );
    if (patch.length === 0) {
      return create(SaveDraftResponseSchema, {
        workflow: toWorkflowProto(existing),
        changed: false,
      });
    }

    let updated: Workflow | undefined;
    try {
      [updated] = await db
        .update(workflows)
        .set({
          name,
          description,
          draftDefinition: definition,
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, existing.id))
        .returning();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConnectError(
          `a workflow named "${name}" already exists`,
          Code.AlreadyExists,
        );
      }
      throw err;
    }
    if (!updated) {
      throw new ConnectError("failed to save draft", Code.Internal);
    }

    // Rewrite draft dependency pins (derived data).
    const pins = extractDependencies(definition);
    await db.delete(workflowDependencies).where(
      and(
        eq(workflowDependencies.sourceWorkflowId, existing.id),
        // draft rows only (sourceVersionId null) — published pins are immutable
        isNull(workflowDependencies.sourceVersionId),
      ),
    );
    if (pins.length > 0) {
      await db.insert(workflowDependencies).values(
        pins.map((p) => ({
          sourceWorkflowId: existing.id,
          sourceVersionId: null,
          targetWorkflowId: p.targetWorkflowId,
          targetVersionNumber: p.targetVersionNumber,
        })),
      );
    }

    await recordEvent(existing.id, user.id, "draft_saved", { patch });

    return create(SaveDraftResponseSchema, {
      workflow: toWorkflowProto(updated),
      changed: true,
    });
  },

  async publishVersion(req, ctx) {
    const user = requireUser(ctx);
    const workflow = await getOwnedWorkflow(req.workflowId, user.id);
    const definition = workflow.draftDefinition as MatrixSchema;

    // Every sub-workflow reference must be a pinned, published version the
    // owner can resolve — a snapshot must be executable forever.
    for (const row of definition.rows ?? []) {
      if (row.type !== "workflow" || !row.subWorkflowId) continue;
      if (!UUID_RE.test(row.subWorkflowId)) {
        throw new ConnectError(
          `row "${row.label}" references sub-workflow "${row.subWorkflowId}" which is not a saved workflow`,
          Code.FailedPrecondition,
        );
      }
      const pinned = row.subWorkflowVersion ?? 0;
      if (pinned < 1) {
        throw new ConnectError(
          `row "${row.label}" must pin a published version of its sub-workflow before publishing`,
          Code.FailedPrecondition,
        );
      }
      const [target] = await db
        .select({
          id: workflows.id,
          name: workflows.name,
          latestVersion: workflows.latestVersion,
        })
        .from(workflows)
        .where(
          and(
            eq(workflows.id, row.subWorkflowId),
            eq(workflows.ownerId, user.id),
          ),
        )
        .limit(1);
      if (!target) {
        throw new ConnectError(
          `row "${row.label}" references a sub-workflow that does not exist`,
          Code.FailedPrecondition,
        );
      }
      if (pinned > target.latestVersion) {
        throw new ConnectError(
          `row "${row.label}" pins ${target.name}@v${pinned}, but its latest published version is v${target.latestVersion}`,
          Code.FailedPrecondition,
        );
      }
    }

    const versionNumber = workflow.latestVersion + 1;
    const versionId = crypto.randomUUID();
    // Stamp the legacy display field on the immutable snapshot.
    const snapshot: MatrixSchema = {
      ...definition,
      version: `${versionNumber}`,
    };

    const [inserted] = await db
      .insert(workflowVersions)
      .values({
        id: versionId,
        workflowId: workflow.id,
        versionNumber,
        definition: snapshot,
        label: req.label || null,
        notes: req.notes || null,
      })
      .returning();
    if (!inserted) {
      throw new ConnectError("failed to publish version", Code.Internal);
    }

    await db
      .update(workflows)
      .set({ latestVersion: versionNumber, updatedAt: new Date() })
      .where(eq(workflows.id, workflow.id));

    const pins = extractDependencies(snapshot);
    if (pins.length > 0) {
      await db.insert(workflowDependencies).values(
        pins.map((p) => ({
          sourceWorkflowId: workflow.id,
          sourceVersionId: versionId,
          targetWorkflowId: p.targetWorkflowId,
          targetVersionNumber: p.targetVersionNumber,
        })),
      );
    }

    await recordEvent(workflow.id, user.id, "published", {
      versionNumber,
      label: req.label || undefined,
    });

    return create(PublishVersionResponseSchema, {
      version: toVersionProto(inserted),
    });
  },

  async deleteWorkflow(req, ctx) {
    const user = requireUser(ctx);
    const workflow = await getOwnedWorkflow(req.workflowId, user.id);

    const dependents = await db
      .selectDistinct({ name: workflows.name })
      .from(workflowDependencies)
      .innerJoin(
        workflows,
        eq(workflows.id, workflowDependencies.sourceWorkflowId),
      )
      .where(
        and(
          eq(workflowDependencies.targetWorkflowId, workflow.id),
          ne(workflowDependencies.sourceWorkflowId, workflow.id),
        ),
      );
    if (dependents.length > 0) {
      const names = dependents.map((d) => `"${d.name}"`).join(", ");
      throw new ConnectError(
        `cannot delete "${workflow.name}" — it is used as a sub-workflow by: ${names}`,
        Code.FailedPrecondition,
      );
    }

    await db.delete(workflows).where(eq(workflows.id, workflow.id));
    // workflow_events has no FK on purpose: the audit trail survives deletion.
    await recordEvent(workflow.id, user.id, "deleted", { name: workflow.name });

    return create(DeleteWorkflowResponseSchema, {});
  },

  async listVersions(req, ctx) {
    const user = requireUser(ctx);
    const workflow = await getOwnedWorkflow(req.workflowId, user.id);
    const rows = await db
      .select()
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowId, workflow.id))
      .orderBy(desc(workflowVersions.versionNumber));
    return create(ListVersionsResponseSchema, {
      versions: rows.map(toVersionProto),
    });
  },

  async getVersion(req, ctx) {
    const user = requireUser(ctx);
    const workflow = await getOwnedWorkflow(req.workflowId, user.id);
    const [row] = await db
      .select()
      .from(workflowVersions)
      .where(
        and(
          eq(workflowVersions.workflowId, workflow.id),
          eq(workflowVersions.versionNumber, req.versionNumber),
        ),
      )
      .limit(1);
    if (!row) {
      throw new ConnectError("version not found", Code.NotFound);
    }
    return create(GetVersionResponseSchema, { version: toVersionProto(row) });
  },

  async listEvents(req, ctx) {
    const user = requireUser(ctx);
    const workflow = await getOwnedWorkflow(req.workflowId, user.id);
    const limit = Math.min(req.limit > 0 ? req.limit : 100, 500);
    const beforeId = Number(req.beforeId);

    const conditions = [eq(workflowEvents.workflowId, workflow.id)];
    if (beforeId > 0) {
      conditions.push(lt(workflowEvents.id, beforeId));
    }
    const rows = await db
      .select()
      .from(workflowEvents)
      .where(and(...conditions))
      .orderBy(desc(workflowEvents.id))
      .limit(limit);

    return create(ListEventsResponseSchema, {
      events: rows.map((row) => ({
        id: BigInt(row.id),
        workflowId: row.workflowId,
        actorId: row.actorId,
        eventType: row.eventType,
        payloadJson: JSON.stringify(row.payload),
        createdAtMs: toMs(row.createdAt),
      })),
    });
  },

  async listTestCases(req, ctx) {
    const user = requireUser(ctx);
    const workflow = await getOwnedWorkflow(req.workflowId, user.id);
    const rows = await db
      .select()
      .from(workflowTestCases)
      .where(eq(workflowTestCases.workflowId, workflow.id))
      .orderBy(desc(workflowTestCases.updatedAt));
    return create(ListTestCasesResponseSchema, {
      testCases: rows.map(toTestCaseProto),
    });
  },

  async saveTestCase(req, ctx) {
    const user = requireUser(ctx);
    if (!req.testCase) {
      throw new ConnectError("test_case is required", Code.InvalidArgument);
    }
    const tc = req.testCase;
    const workflow = await getOwnedWorkflow(tc.workflowId, user.id);

    const parseJsonObject = (json: string, field: string): object => {
      if (!json) return {};
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new ConnectError(
          `${field} is not valid JSON`,
          Code.InvalidArgument,
        );
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new ConnectError(
          `${field} must be a JSON object`,
          Code.InvalidArgument,
        );
      }
      return parsed;
    };

    const name = tc.name.trim();
    if (!name) {
      throw new ConnectError(
        "test case name is required",
        Code.InvalidArgument,
      );
    }
    const values = {
      name,
      description: tc.description ?? "",
      inputs: parseJsonObject(tc.inputsJson, "inputs_json"),
      expected: parseJsonObject(tc.expectedJson, "expected_json"),
    };

    let saved: WorkflowTestCase | undefined;
    if (tc.id) {
      [saved] = await db
        .update(workflowTestCases)
        .set({ ...values, updatedAt: new Date() })
        .where(
          and(
            eq(workflowTestCases.id, tc.id),
            eq(workflowTestCases.workflowId, workflow.id),
          ),
        )
        .returning();
      if (!saved) {
        throw new ConnectError("test case not found", Code.NotFound);
      }
      await recordEvent(workflow.id, user.id, "test_case_updated", {
        testCaseId: saved.id,
        name,
      });
    } else {
      [saved] = await db
        .insert(workflowTestCases)
        .values({ workflowId: workflow.id, ...values })
        .returning();
      if (!saved) {
        throw new ConnectError("failed to create test case", Code.Internal);
      }
      await recordEvent(workflow.id, user.id, "test_case_added", {
        testCaseId: saved.id,
        name,
      });
    }

    return create(SaveTestCaseResponseSchema, {
      testCase: toTestCaseProto(saved),
    });
  },

  async deleteTestCase(req, ctx) {
    const user = requireUser(ctx);
    const workflow = await getOwnedWorkflow(req.workflowId, user.id);
    const [deleted] = await db
      .delete(workflowTestCases)
      .where(
        and(
          eq(workflowTestCases.id, req.testCaseId),
          eq(workflowTestCases.workflowId, workflow.id),
        ),
      )
      .returning({ id: workflowTestCases.id, name: workflowTestCases.name });
    if (!deleted) {
      throw new ConnectError("test case not found", Code.NotFound);
    }
    await recordEvent(workflow.id, user.id, "test_case_deleted", {
      testCaseId: deleted.id,
      name: deleted.name,
    });
    return create(DeleteTestCaseResponseSchema, {});
  },
};
