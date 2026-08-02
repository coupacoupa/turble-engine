import { compileMatrix } from "./compile/compile";
import { executeMatrixSync, ExecuteOptions } from "./exec/execute";
import {
  MatrixExecutionResult,
  projectExecutionResult,
} from "./timeline/project";
import { MatrixSchema } from "./schema/matrix-schema";

/**
 * One-shot convenience: compile + execute + project to the matrix execution result shape
 * the web simulator consumes. Never throws — compile errors come back as a
 * result with `hasErrors: true` and the diagnostics attached.
 */
export function evaluateMatrix(
  matrix: MatrixSchema,
  input: Record<string, unknown>,
  opts: ExecuteOptions = {},
): MatrixExecutionResult {
  const { plan, diagnostics } = compileMatrix(matrix);

  if (!plan) {
    return {
      executionId: "",
      matrixId: matrix.id,
      eventLog: {
        executionId: "",
        matrixId: matrix.id,
        startedAt: 0,
        stepRecords: [],
      },
      finalPayload: {},
      hasErrors: true,
      diagnostics,
    };
  }

  const log = executeMatrixSync(plan, input, opts);
  const result = projectExecutionResult(log);
  if (diagnostics.length > 0) result.diagnostics = diagnostics;
  return result;
}
