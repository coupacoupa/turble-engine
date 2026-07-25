import { CellResult, EmittedCellEvent } from './cell.types';

export interface StepEvaluationRecord {
  stepIndex: number;
  colId: string;
  colLabel: string;
  timestamp: number;
  initialPayload: Record<string, any>;
  finalPayload: Record<string, any>;
  cellResults: CellResult[];
  emittedEvents: EmittedCellEvent[];
}

export interface ReplayEventLog {
  executionId: string;
  matrixId: string;
  startedAt: number;
  completedAt?: number;
  stepRecords: StepEvaluationRecord[];
}
