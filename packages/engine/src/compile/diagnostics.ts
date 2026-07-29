export type DiagnosticCode =
  | 'BAD_CONDITION_SYNTAX'
  | 'BAD_EXPRESSION_SYNTAX'
  | 'MISSING_EXPRESSION_OUTPUT'
  | 'UNRESOLVED_INPUT'
  | 'OUTPUT_CLASH'
  | 'UNSUPPORTED_ACTION'
  | 'LEGACY_EXPRESSION_MIGRATED'
  | 'DUPLICATE_ORDER';

export type DiagnosticSeverity = 'error' | 'warning';

export interface Diagnostic {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  message: string;
  /** Coordinates of the offending element, when known */
  rowId?: string;
  colId?: string;
  cellId?: string;
  actionId?: string;
  ruleIdx?: number;
  key?: string;
}
