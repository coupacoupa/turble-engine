// Schema (source of truth for matrix types) + normalization
export * from './schema/matrix-schema';
export { getCellActions } from './schema/normalize';

// TEL expression language
export type { Value } from './lang/value';
export { truthy, deepEquals, toValue, typeName } from './lang/value';
export type { Expr, BinaryOp, UnaryOp } from './lang/ast';
export { parseExpression } from './lang/parser';
export { evaluate, scopeFromObject } from './lang/eval';
export type { Scope } from './lang/eval';
export { TelSyntaxError, TelRuntimeError } from './lang/errors';
export { compileCondition, coerceMutationValue } from './lang/condition';
export type { CompiledCondition, ConditionOp } from './lang/condition';

// Compile
export { compileMatrix } from './compile/compile';
export type { CompiledPlan, CompileResult, PlannedCell, PlannedAction, PlannedRule } from './compile/plan';
export type { Diagnostic, DiagnosticCode, DiagnosticSeverity } from './compile/diagnostics';

// Events + host
export type {
  ExecutionEvent,
  ExecutionEventType,
  ExecutionLog,
  ConditionResult,
  MutationSource,
} from './events/types';
export { CollectorSink, TeeSink } from './events/sink';
export type { EventSink } from './events/sink';
export { createDefaultHost, createDeterministicHost } from './host/host';
export type { HostEnvironment } from './host/host';

// Execution
export { executeMatrix, executeMatrixSync } from './exec/execute';
export type { ExecuteOptions, CapturePolicy } from './exec/execute';

// Replay & projections
export { createReplay, applyEvent } from './replay/fold';
export type { Replay } from './replay/fold';
export { toLegacyExecutionResult } from './replay/legacy';
export type { MatrixExecutionResult } from './replay/legacy';

// Convenience
export { evaluateMatrix } from './api';
