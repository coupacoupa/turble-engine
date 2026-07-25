export type TokenStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ExecutionToken {
  id: string;
  matrixId: string;
  currentStepIndex: number; // Column index (0-indexed)
  currentColId: string;
  payload: Record<string, any>;
  status: TokenStatus;
  startedAt: number;
  completedAt?: number;
  error?: string;
}
