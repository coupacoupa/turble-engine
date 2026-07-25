import { ServiceImpl } from '@connectrpc/connect';
import { MatrixEvaluatorService } from '@repo/proto';
import {
  ExecuteMatrixRequest,
  ExecuteMatrixResponse,
  StreamExecutionStepsRequest,
  StreamExecutionStepsResponse,
  CellActionType,
} from '@repo/proto';

/** Service Implementation for Connect-RPC MatrixEvaluatorService */
export const matrixEvaluatorHandler: Partial<ServiceImpl<typeof MatrixEvaluatorService>> = {
  async executeMatrix(req: ExecuteMatrixRequest): Promise<ExecuteMatrixResponse> {
    console.log(`[Handler] Executing Matrix RPC for ID: ${req.matrixId}`);

    let payload: Record<string, any> = {};
    try {
      if (req.initialPayloadJson) {
        payload = JSON.parse(req.initialPayloadJson);
      }
    } catch {
      payload = { error: 'Invalid initial JSON payload' };
    }

    // Simulate matrix rule execution
    payload.evaluatorStatus = 'COMPLETED';
    payload.riskTier = 'TIER_1';
    payload.creditLimit = 25000;
    payload.approvedAt = new Date().toISOString();

    return new ExecuteMatrixResponse({
      executionId: `exec_${Date.now()}`,
      matrixId: req.matrixId,
      finalPayloadJson: JSON.stringify(payload, null, 2),
      hasErrors: false,
      stepRecords: [
        {
          stepIndex: 0,
          colId: 'col_intake',
          colLabel: '1. Intake & Validation',
          timestamp: BigInt(Date.now()),
          initialPayloadJson: req.initialPayloadJson || '{}',
          finalPayloadJson: JSON.stringify({ isAdult: true, status: 'ELIGIBLE' }),
          cellResults: [
            {
              cellId: 'c1',
              rowId: 'row_applicant',
              colId: 'col_intake',
              action: CellActionType.TABLE_RULE,
              status: 'success',
              mutatedPayloadJson: JSON.stringify({ status: 'ELIGIBLE' }),
              latencyMs: BigInt(3),
            },
          ],
        },
        {
          stepIndex: 1,
          colId: 'col_scoring',
          colLabel: '2. Risk Scoring',
          timestamp: BigInt(Date.now() + 10),
          initialPayloadJson: JSON.stringify({ isAdult: true, status: 'ELIGIBLE' }),
          finalPayloadJson: JSON.stringify(payload, null, 2),
          cellResults: [
            {
              cellId: 'c2',
              rowId: 'row_bureau',
              colId: 'col_scoring',
              action: CellActionType.EXPRESSION,
              status: 'success',
              mutatedPayloadJson: JSON.stringify(payload),
              latencyMs: BigInt(5),
            },
          ],
        },
      ],
    });
  },

  async *streamExecutionSteps(req: StreamExecutionStepsRequest): AsyncGenerator<StreamExecutionStepsResponse> {
    console.log(`[Handler] Streaming execution steps for Matrix: ${req.matrixId}`);

    const steps = [
      { stepIndex: 0, colId: 'col_intake', colLabel: '1. Intake & Validation' },
      { stepIndex: 1, colId: 'col_scoring', colLabel: '2. Risk Scoring' },
      { stepIndex: 2, colId: 'col_underwriting', colLabel: '3. Underwriting Rule' },
      { stepIndex: 3, colId: 'col_decision', colLabel: '4. Final Decision' },
    ];

    for (const step of steps) {
      // Simulate step latency
      await new Promise((resolve) => setTimeout(resolve, 300));

      yield new StreamExecutionStepsResponse({
        executionId: `exec_stream_${Date.now()}`,
        isCompleted: step.stepIndex === steps.length - 1,
        currentStepRecord: {
          stepIndex: step.stepIndex,
          colId: step.colId,
          colLabel: step.colLabel,
          timestamp: BigInt(Date.now()),
          initialPayloadJson: req.initialPayloadJson || '{}',
          finalPayloadJson: JSON.stringify({ step: step.colLabel, status: 'PROCESSED' }),
          cellResults: [],
        },
      });
    }
  },
};
