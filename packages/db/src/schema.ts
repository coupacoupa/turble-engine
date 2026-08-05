import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Application tables. Auth tables are owned and managed by Neon Auth (in the
 * `neon_auth` Postgres schema) — they are not defined here. `owner_id` /
 * `actor_id` columns hold the verified Neon Auth JWT subject; no cross-schema
 * FK is required.
 *
 * The matrix definition is stored as a self-contained JSONB `MatrixSchema`
 * blob (the engine contract is the source of truth) — any runner that holds
 * one row can execute it. Only fields that are queried on are extracted into
 * columns.
 */

/** Workflow identity + the mutable draft definition. */
export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Full MatrixSchema draft — mutable, overwritten on each save. */
    draftDefinition: jsonb("draft_definition").notNull(),
    /** Highest published version number; 0 = never published. */
    latestVersion: integer("latest_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("workflows_owner_id_idx").on(t.ownerId),
    uniqueIndex("workflows_owner_id_name_uq").on(t.ownerId, t.name),
  ],
);

/** Immutable published snapshots — never updated after insert. */
export const workflowVersions = pgTable(
  "workflow_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    /** Self-contained MatrixSchema snapshot, executable by any runner. */
    definition: jsonb("definition").notNull(),
    label: text("label"),
    notes: text("notes"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("workflow_versions_workflow_id_version_uq").on(
      t.workflowId,
      t.versionNumber,
    ),
  ],
);

/**
 * Sub-workflow pins extracted from definitions (derived data — rewritten on
 * every draft save / publish). `sourceVersionId` null = the pin lives in the
 * draft; set = in that published snapshot. Powers "block deletion while
 * pinned" and, later, export-bundle closure resolution.
 */
export const workflowDependencies = pgTable(
  "workflow_dependencies",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceWorkflowId: uuid("source_workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    sourceVersionId: uuid("source_version_id").references(
      () => workflowVersions.id,
      { onDelete: "cascade" },
    ),
    targetWorkflowId: uuid("target_workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "no action" }),
    targetVersionNumber: integer("target_version_number").notNull(),
  },
  (t) => [
    index("workflow_dependencies_target_idx").on(t.targetWorkflowId),
    index("workflow_dependencies_source_idx").on(t.sourceWorkflowId),
  ],
);

/**
 * Curated test cases (inputs + expected output subset) — the regression suite
 * that follows the workflow across versions. No run results are stored:
 * execution is deterministic, so a test run is recomputable anytime.
 */
export const workflowTestCases = pgTable(
  "workflow_test_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Input variable map fed to the engine. */
    inputs: jsonb("inputs").notNull().default({}),
    /** Expected subset of output variables; pass = every listed key matches. */
    expected: jsonb("expected").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("workflow_test_cases_workflow_id_idx").on(t.workflowId)],
);

/**
 * Append-only audit trail. `workflowId` is deliberately NOT a foreign key so
 * the trail survives workflow deletion (and the `deleted` event itself is
 * recordable). For `draft_saved` the payload is the RFC 6902 JSON Patch
 * computed server-side (old draft → new draft) — the trail cannot drift from
 * reality because the diff and the write happen in the same request.
 */
export const workflowEvents = pgTable(
  "workflow_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workflowId: uuid("workflow_id").notNull(),
    actorId: text("actor_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("workflow_events_workflow_id_idx").on(t.workflowId, t.id)],
);

export type Workflow = typeof workflows.$inferSelect;
export type WorkflowVersion = typeof workflowVersions.$inferSelect;
export type WorkflowDependency = typeof workflowDependencies.$inferSelect;
export type WorkflowTestCase = typeof workflowTestCases.$inferSelect;
export type WorkflowEvent = typeof workflowEvents.$inferSelect;
