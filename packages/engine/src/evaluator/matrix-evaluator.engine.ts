import { MatrixSchema } from '../types/matrix.types';
import { ExecutionToken } from '../types/token.types';
import { ReplayEventLog, StepEvaluationRecord } from '../types/event.types';
import { CellResult, EmittedCellEvent } from '../types/cell.types';
import { CellEvaluatorService, WorkflowSubRunner } from './cell-evaluator.service';

export interface MatrixExecutionResult {
  executionId: string;
  matrixId: string;
  status: 'completed' | 'failed';
  finalPayload: Record<string, any>;
  eventLog: ReplayEventLog;
  emittedEvents: EmittedCellEvent[];
  error?: string;
}

export class MatrixEvaluatorEngine {
  private cellEvaluator = new CellEvaluatorService();
  private subWorkflowRegistry: Record<string, MatrixSchema> = {};

  public registerSubWorkflow(matrix: MatrixSchema): void {
    this.subWorkflowRegistry[matrix.id] = matrix;
  }

  public async executeMatrix(
    matrix: MatrixSchema,
    initialPayload: Record<string, any>,
    executionId = `exec_${Date.now()}`
  ): Promise<MatrixExecutionResult> {
    const startedAt = Date.now();
    let currentPayload = { ...initialPayload };
    const allEmittedEvents: EmittedCellEvent[] = [];
    const stepRecords: StepEvaluationRecord[] = [];

    // Sort columns by order (Step 0 to Step N-1)
    const sortedCols = [...matrix.columns].sort((a, b) => a.order - b.order);
    const sortedRows = [...matrix.rows].sort((a, b) => a.order - b.order);

    const interceptorRows = sortedRows.filter((r) => r.isInterceptor);
    const normalRows = sortedRows.filter((r) => !r.isInterceptor);

    const token: ExecutionToken = {
      id: executionId,
      matrixId: matrix.id,
      currentStepIndex: 0,
      currentColId: sortedCols[0]?.id ?? '',
      payload: currentPayload,
      status: 'running',
      startedAt,
    };

    const subRunner: WorkflowSubRunner = {
      runSubWorkflow: async (subWorkflowId, inputPayload) => {
        const subMatrix = this.subWorkflowRegistry[subWorkflowId];
        if (!subMatrix) {
          throw new Error(`Sub-workflow matrix with ID "${subWorkflowId}" not registered.`);
        }
        const res = await this.executeMatrix(subMatrix, inputPayload, `${executionId}_sub_${subWorkflowId}`);
        return { finalPayload: res.finalPayload, events: res.emittedEvents };
      },
    };

    try {
      for (let stepIdx = 0; stepIdx < sortedCols.length; stepIdx++) {
        const col = sortedCols[stepIdx]!;
        token.currentStepIndex = stepIdx;
        token.currentColId = col.id;

        const stepInitialPayload = { ...currentPayload };
        const stepCellResults: CellResult[] = [];
        const stepEmittedEvents: EmittedCellEvent[] = [];

        // 1. Evaluate Global Interceptors first for this step
        for (const interceptorRow of interceptorRows) {
          const cellKey = `${interceptorRow.id}:${col.id}`;
          const cell = matrix.cells[cellKey];
          const result = await this.cellEvaluator.evaluateCell(interceptorRow, cell, currentPayload, subRunner);
          stepCellResults.push(result);
          if (result.emittedEvents) stepEmittedEvents.push(...result.emittedEvents);
          if (result.status === 'fail') {
            throw new Error(`Interceptor row "${interceptorRow.label}" failed at step "${col.label}": ${result.error}`);
          }
          currentPayload = { ...result.mutatedPayload };
        }

        // 2. Evaluate Normal Domain Rows for this Column step
        if (col.isAsync) {
          // Parallel row execution
          const evalPromises = normalRows.map((row) => {
            const cellKey = `${row.id}:${col.id}`;
            const cell = matrix.cells[cellKey];
            return this.cellEvaluator.evaluateCell(row, cell, currentPayload, subRunner);
          });

          const results = await Promise.all(evalPromises);
          for (const res of results) {
            stepCellResults.push(res);
            if (res.emittedEvents) stepEmittedEvents.push(...res.emittedEvents);
            if (res.status === 'fail') {
              throw new Error(`Row "${res.rowId}" failed at step "${col.label}": ${res.error}`);
            }
            // Merge mutations into payload
            Object.assign(currentPayload, res.mutatedPayload);
          }
        } else {
          // Sequential row evaluation
          for (const row of normalRows) {
            const cellKey = `${row.id}:${col.id}`;
            const cell = matrix.cells[cellKey];
            const result = await this.cellEvaluator.evaluateCell(row, cell, currentPayload, subRunner);
            stepCellResults.push(result);
            if (result.emittedEvents) stepEmittedEvents.push(...result.emittedEvents);
            if (result.status === 'fail') {
              throw new Error(`Row "${row.label}" failed at step "${col.label}": ${result.error}`);
            }
            currentPayload = { ...result.mutatedPayload };
          }
        }

        allEmittedEvents.push(...stepEmittedEvents);

        stepRecords.push({
          stepIndex: stepIdx,
          colId: col.id,
          colLabel: col.label,
          timestamp: Date.now(),
          initialPayload: stepInitialPayload,
          finalPayload: { ...currentPayload },
          cellResults: stepCellResults,
          emittedEvents: stepEmittedEvents,
        });
      }

      token.status = 'completed';
      token.completedAt = Date.now();

      return {
        executionId,
        matrixId: matrix.id,
        status: 'completed',
        finalPayload: currentPayload,
        emittedEvents: allEmittedEvents,
        eventLog: {
          executionId,
          matrixId: matrix.id,
          startedAt,
          completedAt: token.completedAt,
          stepRecords,
        },
      };
    } catch (err: any) {
      token.status = 'failed';
      token.completedAt = Date.now();
      token.error = err.message || String(err);

      return {
        executionId,
        matrixId: matrix.id,
        status: 'failed',
        finalPayload: currentPayload,
        emittedEvents: allEmittedEvents,
        error: token.error,
        eventLog: {
          executionId,
          matrixId: matrix.id,
          startedAt,
          completedAt: token.completedAt,
          stepRecords,
        },
      };
    }
  }
}
