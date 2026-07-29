import { Expr } from '../lang/ast';
import { CompiledCondition } from '../lang/condition';
import { Value } from '../lang/value';
import { Diagnostic } from './diagnostics';

export interface PlannedRule {
  /** Conditions in stable key order */
  conditions: Array<{ key: string; condition: CompiledCondition }>;
  /** Mutations with literals coerced at compile time, in stable key order */
  mutations: Array<{ key: string; value: Value }>;
  emitEvent?: { eventName: string; payload: Record<string, Value> };
}

export type PlannedAction =
  | { kind: 'table_rule'; id: string; enabled: boolean; hitPolicy: 'first_match' | 'all_matches'; rules: PlannedRule[] }
  | { kind: 'expression'; id: string; enabled: boolean; source: string; ast: Expr; outputVariable: string }
  | { kind: 'event_emitter'; id: string; enabled: boolean; eventName: string; payload: Record<string, Value> }
  | { kind: 'unsupported'; id: string; enabled: boolean; type: string };

export interface PlannedCell {
  cellId: string;
  rowId: string;
  colId: string;
  rowIdx: number;
  colIdx: number;
  /** cell.enabled === false → the cell is skipped with a visible event */
  disabled: boolean;
  actions: PlannedAction[];
}

export interface CompiledPlan {
  matrixId: string;
  matrixVersion: string;
  planHash: string;
  columns: Array<{ id: string; label: string }>;
  rows: Array<{ id: string; label: string; type: string }>;
  /** Cells in strict execution order: column by column, then row by row */
  cells: PlannedCell[];
  warnings: Diagnostic[];
}

export interface CompileResult {
  plan?: CompiledPlan;
  diagnostics: Diagnostic[];
}
