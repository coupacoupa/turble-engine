import { createClient } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import { connectTransport } from "@/api/transport";
import {
  MatrixEvaluatorService,
  type ExecuteMatrixResponse,
  ExecuteMatrixRequestSchema,
} from "@repo/proto";
import { evaluateMatrix, type MatrixExecutionResult } from "@repo/engine";
import type {
  MatrixSchema,
  StepEvaluationRecord,
  CellResult,
  CellActionType,
} from "@/types/matrix.types";

/** Result shape consumed by the frontend time-travel debugger & execution inspector */
export type { MatrixExecutionResult };

/** Singleton Connect RPC client instance for MatrixEvaluatorService */
export const matrixEvaluatorClient = createClient(
  MatrixEvaluatorService,
  connectTransport,
);

/** Map protobuf CellActionType enum to local string union */
function mapCellAction(protoAction: number): CellActionType {
  const actionMap: Record<number, CellActionType> = {
    0: "passthrough",
    1: "table_rule",
    2: "expression",
    3: "api_call",
    4: "event_emitter",
    5: "trigger_sub_workflow",
    6: "override_sub_workflow",
    7: "skip_sub_workflow",
  };
  return actionMap[protoAction] ?? "passthrough";
}

/** Transform a protobuf ExecuteMatrixResponse into the frontend-friendly MatrixExecutionResult */
function mapProtoResponseToResult(
  res: ExecuteMatrixResponse,
): MatrixExecutionResult {
  const stepRecords: StepEvaluationRecord[] = (res.stepRecords ?? []).map(
    (step) => {
      const cellResults: CellResult[] = (step.cellResults ?? []).map(
        (cell) => ({
          cellId: cell.cellId,
          rowId: cell.rowId,
          colId: cell.colId,
          action: mapCellAction(cell.action),
          status: (cell.status as "success" | "fail" | "skipped") || "success",
          mutatedPayload: cell.mutatedPayloadJson
            ? JSON.parse(cell.mutatedPayloadJson)
            : {},
          latencyMs: Number(cell.latencyMs),
        }),
      );

      return {
        stepIndex: step.stepIndex,
        colId: step.colId,
        colLabel: step.colLabel,
        timestamp: Number(step.timestamp),
        initialPayload: step.initialPayloadJson
          ? JSON.parse(step.initialPayloadJson)
          : {},
        finalPayload: step.finalPayloadJson
          ? JSON.parse(step.finalPayloadJson)
          : {},
        cellResults,
        emittedEvents: [],
      };
    },
  );

  let finalPayload: Record<string, any> = {};
  try {
    finalPayload = res.finalPayloadJson ? JSON.parse(res.finalPayloadJson) : {};
  } catch {
    finalPayload = { raw: res.finalPayloadJson };
  }

  return {
    executionId: res.executionId,
    matrixId: res.matrixId,
    eventLog: {
      executionId: res.executionId,
      matrixId: res.matrixId,
      startedAt: Date.now(),
      completedAt: Date.now(),
      stepRecords,
    },
    finalPayload,
    hasErrors: res.hasErrors,
  };
}

export class MatrixEvaluatorConnectService {
  /**
   * Execute a matrix. When the full schema is available it runs in-browser on
   * the shared @repo/engine (compile → execute → event log → legacy
   * projection) — the same engine the backend uses, so there is no divergent
   * fallback. The RPC path remains for executions referenced by id only.
   */
  static async executeMatrix(
    matrix: MatrixSchema | string,
    initialPayload: Record<string, any>,
  ): Promise<MatrixExecutionResult> {
    if (typeof matrix !== "string") {
      return evaluateMatrix(matrix, initialPayload);
    }

    const response = await matrixEvaluatorClient.executeMatrix(
      create(ExecuteMatrixRequestSchema, {
        matrixId: matrix,
        initialPayloadJson: JSON.stringify(initialPayload),
      }),
    );
    return mapProtoResponseToResult(response);
  }
}
