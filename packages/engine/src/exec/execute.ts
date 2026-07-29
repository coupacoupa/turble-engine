import { CompiledPlan, PlannedCell } from '../compile/plan';
import { ConditionResult, ExecutionEvent, ExecutionLog, MutationSource } from '../events/types';
import { EventSink } from '../events/sink';
import { createDefaultHost, HostEnvironment } from '../host/host';
import { evaluate, scopeFromObject } from '../lang/eval';
import { toValue, Value } from '../lang/value';

export type CapturePolicy = 'full' | 'none';

export interface ExecuteOptions {
  host?: HostEnvironment;
  /** Receives every event as it is produced (in addition to the returned log). */
  sink?: EventSink;
  /**
   * 'full' records payload values (input, mutation before/after, final payload)
   * in events — what the simulator wants. 'none' records keys only (production
   * logs with PII/size constraints).
   */
  capture?: CapturePolicy;
}

/** Omit that distributes over each member of the event union. */
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

interface Emitter {
  emit(partial: DistributiveOmit<ExecutionEvent, 'seq' | 'tUs'>): void;
}

/**
 * Execute a compiled plan synchronously. Strict ordering: column by column,
 * row by row, action by action. Returns the full event log; state at any point
 * is reconstructable by folding `payload_mutated` events (see replay/).
 */
export function executeMatrixSync(
  plan: CompiledPlan,
  input: Record<string, unknown>,
  opts: ExecuteOptions = {},
): ExecutionLog {
  const host = opts.host ?? createDefaultHost();
  const capture: CapturePolicy = opts.capture ?? 'full';

  const executionId = host.newId('exec');
  const events: ExecutionEvent[] = [];
  const t0 = host.now();
  let seq = 0;

  const emitter: Emitter = {
    emit(partial) {
      const event = { ...partial, seq: seq++, tUs: host.now() - t0 } as ExecutionEvent;
      events.push(event);
      opts.sink?.emit(event);
    },
  };

  const payload: Record<string, Value> = {};
  for (const [k, v] of Object.entries(input ?? {})) payload[k] = toValue(v);

  const execSpan = host.newId('span');
  emitter.emit({
    type: 'execution_started',
    spanId: execSpan,
    executionId,
    matrixId: plan.matrixId,
    planHash: plan.planHash,
    wallStartMs: host.wallClock(),
    input: capture === 'full' ? { ...payload } : undefined,
  });

  let currentColIdx = -1;
  let currentColSpan = '';
  let hadFailure = false;

  const closeColumn = () => {
    if (currentColIdx >= 0) {
      emitter.emit({ type: 'column_completed', spanId: currentColSpan, parentSpanId: execSpan, colId: plan.columns[currentColIdx]!.id });
    }
  };

  for (const cell of plan.cells) {
    if (cell.colIdx !== currentColIdx) {
      closeColumn();
      currentColIdx = cell.colIdx;
      currentColSpan = host.newId('span');
      const col = plan.columns[cell.colIdx]!;
      emitter.emit({
        type: 'column_started',
        spanId: currentColSpan,
        parentSpanId: execSpan,
        colId: col.id,
        colIdx: cell.colIdx,
        colLabel: col.label,
      });
    }

    if (cell.disabled) {
      emitter.emit({
        type: 'cell_skipped',
        spanId: host.newId('span'),
        parentSpanId: currentColSpan,
        cellId: cell.cellId,
        rowId: cell.rowId,
        colId: cell.colId,
        reason: 'disabled',
      });
      continue;
    }

    if (executeCell(cell, payload, emitter, host, currentColSpan, capture)) {
      hadFailure = true;
    }
  }
  closeColumn();

  emitter.emit({
    type: 'execution_completed',
    spanId: execSpan,
    finalPayload: capture === 'full' ? { ...payload } : undefined,
  });
  void hadFailure; // recorded per-action via action_failed; projections derive hasErrors from those

  return { executionId, matrixId: plan.matrixId, events };
}

/** Returns true if any action in the cell failed. */
function executeCell(
  cell: PlannedCell,
  payload: Record<string, Value>,
  emitter: Emitter,
  host: HostEnvironment,
  columnSpan: string,
  capture: CapturePolicy,
): boolean {
  const cellSpan = host.newId('span');
  const cellStart = host.now();
  emitter.emit({
    type: 'cell_started',
    spanId: cellSpan,
    parentSpanId: columnSpan,
    cellId: cell.cellId,
    rowId: cell.rowId,
    colId: cell.colId,
  });

  let failed = false;

  for (let actionIdx = 0; actionIdx < cell.actions.length; actionIdx++) {
    const action = cell.actions[actionIdx]!;
    const actionSpan = host.newId('span');

    if (!action.enabled || action.kind === 'unsupported') {
      emitter.emit({
        type: 'action_skipped',
        spanId: actionSpan,
        parentSpanId: cellSpan,
        actionId: action.id,
        actionType: action.kind === 'unsupported' ? action.type : action.kind,
        reason: !action.enabled ? 'disabled' : 'unsupported',
      });
      continue;
    }

    emitter.emit({
      type: 'action_started',
      spanId: actionSpan,
      parentSpanId: cellSpan,
      actionId: action.id,
      actionType: action.kind,
      actionIdx,
    });

    const source: MutationSource = { cellId: cell.cellId, actionId: action.id };

    const mutate = (key: string, after: Value, ruleIdx?: number) => {
      const before = Object.prototype.hasOwnProperty.call(payload, key) ? payload[key]! : null;
      payload[key] = after;
      emitter.emit({
        type: 'payload_mutated',
        spanId: actionSpan,
        parentSpanId: cellSpan,
        key,
        before: capture === 'full' ? before : undefined,
        after: capture === 'full' ? after : undefined,
        source: ruleIdx === undefined ? source : { ...source, ruleIdx },
      });
    };

    switch (action.kind) {
      case 'table_rule': {
        for (let ruleIdx = 0; ruleIdx < action.rules.length; ruleIdx++) {
          const rule = action.rules[ruleIdx]!;
          const conditionResults: ConditionResult[] = rule.conditions.map(({ key, condition }) => {
            const actual = Object.prototype.hasOwnProperty.call(payload, key) ? payload[key]! : null;
            return { key, expected: condition.source, actual, pass: condition.test(actual) };
          });
          const matched = conditionResults.every((c) => c.pass);
          emitter.emit({
            type: 'rule_evaluated',
            spanId: actionSpan,
            parentSpanId: cellSpan,
            ruleIdx,
            matched,
            conditionResults,
          });

          if (!matched) continue;

          for (const m of rule.mutations) mutate(m.key, m.value, ruleIdx);
          if (rule.emitEvent) {
            emitter.emit({
              type: 'event_emitted',
              spanId: actionSpan,
              parentSpanId: cellSpan,
              eventName: rule.emitEvent.eventName,
              payload: rule.emitEvent.payload,
              source: { ...source, ruleIdx },
            });
          }
          if (action.hitPolicy === 'first_match') break;
        }
        emitter.emit({ type: 'action_completed', spanId: actionSpan, parentSpanId: cellSpan, actionId: action.id });
        break;
      }

      case 'expression': {
        try {
          const result = evaluate(action.ast, scopeFromObject(payload));
          mutate(action.outputVariable, result);
          emitter.emit({ type: 'action_completed', spanId: actionSpan, parentSpanId: cellSpan, actionId: action.id });
        } catch (e) {
          failed = true;
          emitter.emit({
            type: 'action_failed',
            spanId: actionSpan,
            parentSpanId: cellSpan,
            actionId: action.id,
            error: (e as Error).message,
          });
        }
        break;
      }

      case 'event_emitter': {
        emitter.emit({
          type: 'event_emitted',
          spanId: actionSpan,
          parentSpanId: cellSpan,
          eventName: action.eventName,
          payload: action.payload,
          source,
        });
        emitter.emit({ type: 'action_completed', spanId: actionSpan, parentSpanId: cellSpan, actionId: action.id });
        break;
      }
    }
  }

  emitter.emit({
    type: 'cell_completed',
    spanId: cellSpan,
    parentSpanId: columnSpan,
    cellId: cell.cellId,
    status: failed ? 'fail' : 'success',
    latencyUs: Math.max(1, host.now() - cellStart),
  });

  return failed;
}

/** Async facade — Phase 2 (api_call effects) makes this genuinely async. */
export async function executeMatrix(
  plan: CompiledPlan,
  input: Record<string, unknown>,
  opts: ExecuteOptions = {},
): Promise<ExecutionLog> {
  return executeMatrixSync(plan, input, opts);
}
