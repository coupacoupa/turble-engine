export type PlainCellAction = 'table_rule' | 'expression' | 'api_call' | 'event_emitter' | 'passthrough';
export type WorkflowCellAction = 'trigger_sub_workflow' | 'override_sub_workflow' | 'skip_sub_workflow';

export type CellActionType = PlainCellAction | WorkflowCellAction;

/** Rule match condition for custom table_rule cell action */
export interface TableRuleMatch {
  /** Condition map: e.g. { creditScore: ">= 700", dti: "<= 0.35" } */
  conditions: Record<string, string>;
  /** Mutations applied to payload if matched: e.g. { status: "APPROVED", limit: 25000 } */
  mutations: Record<string, any>;
  /** Optional custom event payload emitted on match */
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
  /** Mappings from parent matrix payload variables to sub-workflow inputs */
  inputMapping: Record<string, string>;
  /** Mappings from sub-workflow output variables back into parent matrix payload */
  outputMapping: Record<string, string>;
  /** Optional overrides specific to this cell coordinate */
  parameterOverrides?: Record<string, any>;
}

export interface CellSchema {
  id: string;
  rowId: string;
  colId: string;
  action: CellActionType;
  enabled?: boolean;
  
  // Action configurations based on RowType
  tableRuleConfig?: TableRuleConfig;
  expressionConfig?: ExpressionConfig;
  apiCallConfig?: ApiCallConfig;
  eventEmitterConfig?: EventEmitterConfig;
  subWorkflowConfig?: SubWorkflowTriggerConfig;
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
