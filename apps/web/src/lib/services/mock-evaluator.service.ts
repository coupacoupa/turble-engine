import { MatrixSchema, ReplayEventLog, StepEvaluationRecord, CellResult } from '../../types/matrix.types';

export interface MatrixExecutionResult {
  token: any;
  eventLog: ReplayEventLog;
  finalPayload: Record<string, any>;
  hasErrors: boolean;
}

export class MockEvaluatorService {
  static executeMatrix(matrix: MatrixSchema, initialPayload: Record<string, any>): MatrixExecutionResult {
    let currentPayload = { ...initialPayload };
    const stepRecords: StepEvaluationRecord[] = [];
    const executionId = `exec_${Date.now()}`;
    const startedAt = Date.now();

    matrix.columns.forEach((col, colIndex) => {
      const stepInitialPayload = { ...currentPayload };
      const cellResults: CellResult[] = [];

      matrix.rows.forEach((row) => {
        const cell = matrix.cells[`${row.id}:${col.id}`];
        if (cell && cell.enabled !== false) {
          // Simulate rule evaluation
          let status: 'success' | 'fail' | 'skipped' = 'success';
          if (cell.action === 'table_rule' && cell.tableRuleConfig) {
            cell.tableRuleConfig.rules.forEach((rule) => {
              Object.assign(currentPayload, rule.mutations);
            });
          } else if (cell.action === 'expression' && cell.expressionConfig) {
            currentPayload[cell.expressionConfig.outputVariable] = 'Simulated Output';
          } else if (cell.action === 'trigger_sub_workflow') {
            currentPayload[`subwf_${row.id}`] = { status: 'COMPLETED', result: 'APPROVED' };
          }

          cellResults.push({
            cellId: cell.id,
            rowId: row.id,
            colId: col.id,
            action: cell.action,
            status,
            mutatedPayload: { ...currentPayload },
            latencyMs: Math.floor(Math.random() * 15) + 2,
          });
        }
      });

      stepRecords.push({
        stepIndex: colIndex,
        colId: col.id,
        colLabel: col.label,
        timestamp: Date.now(),
        initialPayload: stepInitialPayload,
        finalPayload: { ...currentPayload },
        cellResults,
        emittedEvents: [],
      });
    });

    return {
      token: {
        id: executionId,
        matrixId: matrix.id,
        currentStepIndex: matrix.columns.length - 1,
        currentColId: matrix.columns[matrix.columns.length - 1]?.id || '',
        payload: currentPayload,
        status: 'completed',
        startedAt,
        completedAt: Date.now(),
      },
      eventLog: {
        executionId,
        matrixId: matrix.id,
        startedAt,
        completedAt: Date.now(),
        stepRecords,
      },
      finalPayload: currentPayload,
      hasErrors: false,
    };
  }

  static replayUntilStep(eventLog: ReplayEventLog, stepIndex: number) {
    if (!eventLog || !eventLog.stepRecords || eventLog.stepRecords.length === 0) {
      return { currentPayload: {}, activeStepRecord: undefined };
    }
    const safeIndex = Math.min(Math.max(0, stepIndex), eventLog.stepRecords.length - 1);
    const stepRecord = eventLog.stepRecords[safeIndex];
    return {
      currentPayload: stepRecord.finalPayload,
      activeStepRecord: stepRecord,
    };
  }
}
