export type RowType = 'plain' | 'workflow';

export type PlainCellAction = 'table_rule' | 'expression' | 'api_call' | 'event_emitter' | 'passthrough';
export type WorkflowCellAction = 'trigger_sub_workflow' | 'override_sub_workflow' | 'skip_sub_workflow';

export type CellActionType = PlainCellAction | WorkflowCellAction;

/** Rule match condition for custom table_rule cell action */
export interface TableRuleMatch {
  conditions: Record<string, string>;
  mutations: Record<string, any>;
  emitEvent?: {
    eventName: string;
    payload: Record<string, any>;
  };
}

export interface TableRuleConfig {
  rules: TableRuleMatch[];
  hitPolicy?: 'first_match' | 'all_matches';
}

export interface ExpressionConfig {
  expression: string;
  outputVariable: string;
}

export interface ApiCallConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  bodyMapping?: Record<string, string>;
  responseMapping?: Record<string, string>;
}

export interface EventEmitterConfig {
  eventName: string;
  eventPayload: Record<string, any>;
}

export interface SubWorkflowTriggerConfig {
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  parameterOverrides?: Record<string, any>;
}

export interface CellSchema {
  id: string;
  rowId: string;
  colId: string;
  action: CellActionType;
  enabled?: boolean;
  
  tableRuleConfig?: TableRuleConfig;
  expressionConfig?: ExpressionConfig;
  apiCallConfig?: ApiCallConfig;
  eventEmitterConfig?: EventEmitterConfig;
  subWorkflowConfig?: SubWorkflowTriggerConfig;
}

export interface StepColumnSchema {
  id: string;
  label: string;
  order: number;
  isAsync?: boolean;
}

export interface DomainRowSchema {
  id: string;
  label: string;
  order: number;
  type: RowType;
  subWorkflowId?: string;
  isInterceptor?: boolean;
}

export interface MatrixSchema {
  id: string;
  name: string;
  description?: string;
  version: string;
  columns: StepColumnSchema[];
  rows: DomainRowSchema[];
  cells: Record<string, CellSchema>;
}

export interface EmittedCellEvent {
  eventName: string;
  rowId: string;
  colId: string;
  payload: Record<string, any>;
  timestamp: number;
}

export interface CellResult {
  cellId: string;
  rowId: string;
  colId: string;
  action: CellActionType;
  status: 'success' | 'fail' | 'skipped';
  mutatedPayload: Record<string, any>;
  emittedEvents?: EmittedCellEvent[];
  matchedRules?: number[];
  error?: string;
  latencyMs: number;
}

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

export type TokenStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ExecutionToken {
  id: string;
  matrixId: string;
  currentStepIndex: number;
  currentColId: string;
  payload: Record<string, any>;
  status: TokenStatus;
  startedAt: number;
  completedAt?: number;
  error?: string;
}
