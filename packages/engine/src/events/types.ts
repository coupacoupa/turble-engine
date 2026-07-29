import { Value } from '../lang/value';

/**
 * The append-only execution event log is the single source of truth for an
 * execution. Everything the UI shows (step records, time travel, timings) is a
 * projection of these events.
 *
 * Timing model: `tUs` is monotonic microseconds since execution start. Wall
 * clock exists only on ExecutionStarted (`wallStartMs`), so logs from
 * deterministic hosts are byte-stable and replayable.
 */
export interface EventBase {
  seq: number;
  spanId: string;
  parentSpanId?: string;
  tUs: number;
}

export interface ConditionResult {
  key: string;
  /** Original condition source, e.g. '>= 700' ('' = wildcard) */
  expected: string;
  actual: Value;
  pass: boolean;
}

export interface MutationSource {
  cellId: string;
  actionId: string;
  ruleIdx?: number;
}

export type ExecutionEvent =
  | (EventBase & { type: 'execution_started'; executionId: string; matrixId: string; planHash: string; wallStartMs: number; input?: Record<string, Value> })
  | (EventBase & { type: 'column_started'; colId: string; colIdx: number; colLabel: string })
  | (EventBase & { type: 'column_completed'; colId: string })
  | (EventBase & { type: 'cell_started'; cellId: string; rowId: string; colId: string })
  | (EventBase & { type: 'cell_completed'; cellId: string; status: 'success' | 'fail'; latencyUs: number })
  | (EventBase & { type: 'cell_skipped'; cellId: string; rowId: string; colId: string; reason: 'disabled' })
  | (EventBase & { type: 'action_started'; actionId: string; actionType: string; actionIdx: number })
  | (EventBase & { type: 'action_completed'; actionId: string })
  | (EventBase & { type: 'action_skipped'; actionId: string; actionType: string; reason: 'disabled' | 'unsupported' })
  | (EventBase & { type: 'action_failed'; actionId: string; error: string })
  | (EventBase & { type: 'rule_evaluated'; ruleIdx: number; matched: boolean; conditionResults: ConditionResult[] })
  | (EventBase & { type: 'payload_mutated'; key: string; before?: Value; after?: Value; source: MutationSource })
  | (EventBase & { type: 'event_emitted'; eventName: string; payload: Record<string, Value>; source: MutationSource })
  | (EventBase & { type: 'execution_completed'; finalPayload?: Record<string, Value> })
  | (EventBase & { type: 'execution_failed'; error: string });

export type ExecutionEventType = ExecutionEvent['type'];

export interface ExecutionLog {
  executionId: string;
  matrixId: string;
  events: ExecutionEvent[];
}
