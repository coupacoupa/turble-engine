import { create } from "@bufbuild/protobuf";
import { callUnaryMethod } from "@connectrpc/connect-query";
import { connectTransport } from "@/api/transport";
import type { MatrixSchema } from "@/types/matrix.types";
import {
  CreateWorkflowRequestSchema,
  DeleteWorkflowRequestSchema,
  GetWorkflowRequestSchema,
  ListVersionsRequestSchema,
  ListWorkflowsRequestSchema,
  PublishVersionRequestSchema,
  SaveDraftRequestSchema,
  WorkflowService,
  type Workflow,
  type WorkflowVersion,
} from "@repo/proto";

/** Directory-level view of a workflow (no definition blob). */
export interface WorkflowSummaryView {
  id: string;
  name: string;
  description: string;
  latestVersion: number;
  columnCount: number;
  rowCount: number;
  updatedAtMs: number;
}

/** Full workflow record with the parsed draft MatrixSchema. */
export interface WorkflowRecord {
  id: string;
  name: string;
  description: string;
  latestVersion: number;
  matrix: MatrixSchema;
  updatedAtMs: number;
}

export interface WorkflowVersionView {
  id: string;
  workflowId: string;
  versionNumber: number;
  matrix: MatrixSchema;
  label: string;
  notes: string;
  publishedAtMs: number;
}

function toRecord(wf: Workflow): WorkflowRecord {
  return {
    id: wf.id,
    name: wf.name,
    description: wf.description,
    latestVersion: wf.latestVersion,
    matrix: JSON.parse(wf.draftDefinitionJson) as MatrixSchema,
    updatedAtMs: Number(wf.updatedAtMs),
  };
}

function toVersionView(v: WorkflowVersion): WorkflowVersionView {
  return {
    id: v.id,
    workflowId: v.workflowId,
    versionNumber: v.versionNumber,
    matrix: JSON.parse(v.definitionJson) as MatrixSchema,
    label: v.label,
    notes: v.notes,
    publishedAtMs: Number(v.publishedAtMs),
  };
}

/** Owner-scoped workflow persistence over Connect-RPC (replaces localStorage). */
export class WorkflowApiService {
  static async list(): Promise<WorkflowSummaryView[]> {
    const res = await callUnaryMethod(
      connectTransport,
      WorkflowService.method.listWorkflows,
      create(ListWorkflowsRequestSchema, {}),
    );
    return res.workflows.map((wf) => ({
      id: wf.id,
      name: wf.name,
      description: wf.description,
      latestVersion: wf.latestVersion,
      columnCount: wf.columnCount,
      rowCount: wf.rowCount,
      updatedAtMs: Number(wf.updatedAtMs),
    }));
  }

  static async get(workflowId: string): Promise<WorkflowRecord> {
    const res = await callUnaryMethod(
      connectTransport,
      WorkflowService.method.getWorkflow,
      create(GetWorkflowRequestSchema, { workflowId }),
    );
    if (!res.workflow) throw new Error("workflow not found");
    return toRecord(res.workflow);
  }

  static async create(
    definition: Partial<MatrixSchema> & { name: string },
  ): Promise<WorkflowRecord> {
    const res = await callUnaryMethod(
      connectTransport,
      WorkflowService.method.createWorkflow,
      create(CreateWorkflowRequestSchema, {
        name: definition.name,
        description: definition.description ?? "",
        definitionJson: JSON.stringify({
          id: "",
          columns: [],
          rows: [],
          cells: {},
          ...definition,
        }),
      }),
    );
    if (!res.workflow) throw new Error("failed to create workflow");
    return toRecord(res.workflow);
  }

  static async saveDraft(
    workflowId: string,
    matrix: MatrixSchema,
  ): Promise<{ record: WorkflowRecord; changed: boolean }> {
    const res = await callUnaryMethod(
      connectTransport,
      WorkflowService.method.saveDraft,
      create(SaveDraftRequestSchema, {
        workflowId,
        definitionJson: JSON.stringify(matrix),
      }),
    );
    if (!res.workflow) throw new Error("failed to save draft");
    return { record: toRecord(res.workflow), changed: res.changed };
  }

  static async publish(
    workflowId: string,
    label?: string,
  ): Promise<WorkflowVersionView> {
    const res = await callUnaryMethod(
      connectTransport,
      WorkflowService.method.publishVersion,
      create(PublishVersionRequestSchema, {
        workflowId,
        label: label ?? "",
      }),
    );
    if (!res.version) throw new Error("failed to publish version");
    return toVersionView(res.version);
  }

  static async delete(workflowId: string): Promise<void> {
    await callUnaryMethod(
      connectTransport,
      WorkflowService.method.deleteWorkflow,
      create(DeleteWorkflowRequestSchema, { workflowId }),
    );
  }

  static async listVersions(
    workflowId: string,
  ): Promise<WorkflowVersionView[]> {
    const res = await callUnaryMethod(
      connectTransport,
      WorkflowService.method.listVersions,
      create(ListVersionsRequestSchema, { workflowId }),
    );
    return res.versions.map(toVersionView);
  }
}
