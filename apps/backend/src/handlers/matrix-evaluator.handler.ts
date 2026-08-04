import { create } from "@bufbuild/protobuf";
import type { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { kUser } from "@/interceptors/auth.interceptor";
import {
  CellResult,
  evaluateMatrix,
  MatrixSchema,
  StepEvaluationRecord,
} from "@repo/engine";
import {
  CellActionType,
  type ExecuteMatrixRequest,
  ExecuteMatrixResponseSchema,
  MatrixEvaluatorService,
  type StreamExecutionStepsRequest,
  StreamExecutionStepsResponseSchema,
} from "@repo/proto";

function mapStringToActionProto(actionStr: string): CellActionType {
  const map: Record<string, CellActionType> = {
    passthrough: CellActionType.PASSTHROUGH,
    table_rule: CellActionType.TABLE_RULE,
    expression: CellActionType.EXPRESSION,
    api_call: CellActionType.API_CALL,
    event_emitter: CellActionType.EVENT_EMITTER,
    trigger_sub_workflow: CellActionType.TRIGGER_SUB_WORKFLOW,
    override_sub_workflow: CellActionType.OVERRIDE_SUB_WORKFLOW,
    skip_sub_workflow: CellActionType.SKIP_SUB_WORKFLOW,
  };
  return map[actionStr] ?? CellActionType.PASSTHROUGH;
}

function mapProtoActionToString(actionProto: CellActionType): any {
  const map: Record<number, string> = {
    [CellActionType.PASSTHROUGH]: "passthrough",
    [CellActionType.TABLE_RULE]: "table_rule",
    [CellActionType.EXPRESSION]: "expression",
    [CellActionType.API_CALL]: "api_call",
    [CellActionType.EVENT_EMITTER]: "event_emitter",
    [CellActionType.TRIGGER_SUB_WORKFLOW]: "trigger_sub_workflow",
    [CellActionType.OVERRIDE_SUB_WORKFLOW]: "override_sub_workflow",
    [CellActionType.SKIP_SUB_WORKFLOW]: "skip_sub_workflow",
  };
  return map[actionProto] || "passthrough";
}

function mapProtoMatrixSchemaToEngine(protoSchema: any): MatrixSchema {
  const columns = (protoSchema.columns || []).map((col: any) => ({
    id: col.id,
    label: col.label,
    order: col.order,
    isAsync: col.isAsync,
  }));

  const rows = (protoSchema.rows || []).map((row: any) => ({
    id: row.id,
    label: row.label,
    order: row.order,
    type: row.type === 2 ? ("workflow" as const) : ("standard" as const),
    subWorkflowId: row.subWorkflowId,
    isInterceptor: row.isInterceptor,
  }));

  const cells: Record<string, any> = {};
  if (protoSchema.cells) {
    for (const [key, cellProto] of Object.entries<any>(protoSchema.cells)) {
      cells[key] = {
        id: cellProto.id,
        rowId: cellProto.rowId,
        colId: cellProto.colId,
        action: mapProtoActionToString(cellProto.action),
        enabled: cellProto.enabled !== false,
        tableRuleConfig: cellProto.tableRuleConfig
          ? {
              hitPolicy: cellProto.tableRuleConfig.hitPolicy,
              rules: (cellProto.tableRuleConfig.rules || []).map((r: any) => ({
                conditions: r.conditions || {},
                mutations: r.mutations || {},
                emitEvent: r.emitEventName
                  ? { eventName: r.emitEventName }
                  : undefined,
              })),
            }
          : undefined,
        expressionConfig: cellProto.expressionConfig
          ? {
              expression: cellProto.expressionConfig.expression,
              outputVariable: cellProto.expressionConfig.outputVariable,
            }
          : undefined,
        subWorkflowConfig: cellProto.subWorkflowConfig
          ? {
              inputMapping: cellProto.subWorkflowConfig.inputMapping || {},
              outputMapping: cellProto.subWorkflowConfig.outputMapping || {},
            }
          : undefined,
      };
    }
  }

  return {
    id: protoSchema.id || "matrix",
    name: protoSchema.name || "",
    description: protoSchema.description || "",
    version: protoSchema.version || "1.0.0",
    columns,
    rows,
    cells,
  };
}

/** Service Implementation for Connect-RPC MatrixEvaluatorService */
export const matrixEvaluatorHandler: ServiceImpl<
  typeof MatrixEvaluatorService
> = {
  async executeMatrix(req: ExecuteMatrixRequest, ctx: HandlerContext) {
    const user = ctx.values.get(kUser);
    console.log(
      `[Handler] Executing Matrix RPC for ID: ${req.matrixId} | user: ${user?.email ?? user?.id}`,
    );

    if (!req.matrixSchema) {
      return create(ExecuteMatrixResponseSchema, {
        executionId: `exec_err_${Date.now()}`,
        matrixId: req.matrixId,
        finalPayloadJson: JSON.stringify({
          error:
            "Missing matrixSchema in ExecuteMatrixRequest. Matrix execution requires a valid schema.",
        }),
        hasErrors: true,
        stepRecords: [],
      });
    }

    let initialPayload: Record<string, any> = {};
    if (req.initialPayloadJson) {
      try {
        initialPayload = JSON.parse(req.initialPayloadJson);
      } catch (err) {
        return create(ExecuteMatrixResponseSchema, {
          executionId: `exec_err_${Date.now()}`,
          matrixId: req.matrixId,
          finalPayloadJson: JSON.stringify({
            error: `Invalid initialPayloadJson JSON syntax: ${err instanceof Error ? err.message : String(err)}`,
          }),
          hasErrors: true,
          stepRecords: [],
        });
      }
    }

    const matrixToRun = mapProtoMatrixSchemaToEngine(req.matrixSchema);
    const engineResult = evaluateMatrix(matrixToRun, initialPayload);

    const stepRecordsProto = (engineResult.eventLog?.stepRecords ?? []).map(
      (step: StepEvaluationRecord) => ({
        stepIndex: step.stepIndex,
        colId: step.colId,
        colLabel: step.colLabel,
        timestamp: BigInt(step.timestamp || Date.now()),
        initialPayloadJson: JSON.stringify(step.initialPayload || {}),
        finalPayloadJson: JSON.stringify(step.finalPayload || {}),
        cellResults: (step.cellResults ?? []).map((cell: CellResult) => ({
          cellId: cell.cellId,
          rowId: cell.rowId,
          colId: cell.colId,
          action: mapStringToActionProto(cell.action),
          status: cell.status,
          mutatedPayloadJson: JSON.stringify(cell.mutatedPayload || {}),
          latencyMs: BigInt(cell.latencyMs || 1),
        })),
      }),
    );

    return create(ExecuteMatrixResponseSchema, {
      executionId: engineResult.executionId || `exec_${Date.now()}`,
      matrixId: req.matrixId || matrixToRun.id,
      finalPayloadJson: JSON.stringify(engineResult.finalPayload, null, 2),
      hasErrors: engineResult.hasErrors,
      stepRecords: stepRecordsProto,
    });
  },

  async *streamExecutionSteps(req: StreamExecutionStepsRequest) {
    console.log(
      `[Handler] Streaming execution steps for Matrix: ${req.matrixId}`,
    );

    yield create(StreamExecutionStepsResponseSchema, {
      executionId: `exec_stream_err_${Date.now()}`,
      isCompleted: true,
      currentStepRecord: {
        stepIndex: 0,
        colId: "error",
        colLabel: "Execution Request Error",
        timestamp: BigInt(Date.now()),
        initialPayloadJson: req.initialPayloadJson || "{}",
        finalPayloadJson: JSON.stringify({
          error: "Stream execution requires matrix payload",
        }),
        cellResults: [],
      },
    });
  },
};
