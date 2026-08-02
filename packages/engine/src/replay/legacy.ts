import { ExecutionLog } from "../events/types";
import { Value } from "../lang/value";
import {
  CellActionType,
  CellResult,
  EmittedCellEvent,
  ReplayEventLog,
  StepEvaluationRecord,
} from "../schema/matrix-schema";
import { Diagnostic } from "../compile/diagnostics";

/** Result shape consumed by the frontend time-travel debugger & execution inspector. */
export interface MatrixExecutionResult {
  executionId: string;
  matrixId: string;
  eventLog: ReplayEventLog;
  finalPayload: Record<string, any>;
  hasErrors: boolean;
  /** Compile diagnostics (errors when compilation failed, warnings otherwise) */
  diagnostics?: Diagnostic[];
}

/**
 * Project an event log into the legacy per-cell step-record shape the current
 * simulator components consume. One StepEvaluationRecord per executed cell —
 * payload snapshots are materialized here by folding mutation deltas, so the
 * engine itself never clones payloads during execution.
 *
 * Requires a log captured with `capture: 'full'`.
 */
export function toLegacyExecutionResult(
  log: ExecutionLog,
): MatrixExecutionResult {
  const stepRecords: StepEvaluationRecord[] = [];
  const payload: Record<string, Value> = {};

  let executionId = log.executionId;
  let matrixId = log.matrixId;
  let wallStartMs = 0;
  let lastTUs = 0;
  let hasErrors = false;

  let currentColId = "";
  let currentColLabel = "";

  interface OpenCell {
    cellId: string;
    rowId: string;
    colId: string;
    colLabel: string;
    startTUs: number;
    initialPayload: Record<string, Value>;
    mutatedPayload: Record<string, Value>;
    matchedRules: number[];
    emittedEvents: EmittedCellEvent[];
    actionTypes: string[];
    error?: string;
  }
  let open: OpenCell | undefined;
  let stepIndex = 0;

  for (const event of log.events) {
    lastTUs = event.tUs;

    switch (event.type) {
      case "execution_started":
        executionId = event.executionId;
        matrixId = event.matrixId;
        wallStartMs = event.wallStartMs;
        if (event.input)
          for (const [k, v] of Object.entries(event.input)) payload[k] = v;
        break;

      case "column_started":
        currentColId = event.colId;
        currentColLabel = event.colLabel;
        break;

      case "cell_started":
        open = {
          cellId: event.cellId,
          rowId: event.rowId,
          colId: event.colId,
          colLabel: currentColLabel,
          startTUs: event.tUs,
          initialPayload: { ...payload },
          mutatedPayload: {},
          matchedRules: [],
          emittedEvents: [],
          actionTypes: [],
        };
        break;

      case "action_started":
        open?.actionTypes.push(event.actionType);
        break;

      case "action_skipped":
        open?.actionTypes.push(event.actionType);
        break;

      case "action_failed":
        hasErrors = true;
        if (open && open.error === undefined) open.error = event.error;
        break;

      case "rule_evaluated":
        if (event.matched) open?.matchedRules.push(event.ruleIdx);
        break;

      case "payload_mutated": {
        const after = event.after === undefined ? null : event.after;
        payload[event.key] = after;
        if (open) open.mutatedPayload[event.key] = after;
        break;
      }

      case "event_emitted":
        if (open) {
          open.emittedEvents.push({
            eventName: event.eventName,
            rowId: open.rowId,
            colId: open.colId,
            payload: event.payload,
            timestamp: wallStartMs + Math.round(event.tUs / 1000),
          });
        }
        break;

      case "cell_completed": {
        if (!open) break;
        const cellResult: CellResult = {
          cellId: open.cellId,
          rowId: open.rowId,
          colId: open.colId,
          action: (open.actionTypes[0] as CellActionType) ?? "passthrough",
          status: event.status,
          mutatedPayload: open.mutatedPayload,
          emittedEvents: open.emittedEvents.length
            ? open.emittedEvents
            : undefined,
          matchedRules: open.matchedRules.length
            ? open.matchedRules
            : undefined,
          error: open.error,
          latencyMs: Math.max(1, Math.round(event.latencyUs / 1000)),
        };
        stepRecords.push({
          stepIndex: stepIndex++,
          colId: open.colId,
          colLabel: open.colLabel || currentColId,
          timestamp: wallStartMs + Math.round(event.tUs / 1000),
          initialPayload: open.initialPayload,
          finalPayload: { ...payload },
          cellResults: [cellResult],
          emittedEvents: open.emittedEvents,
        });
        open = undefined;
        break;
      }

      case "execution_failed":
        hasErrors = true;
        break;

      default:
        break;
    }
  }

  const eventLog: ReplayEventLog = {
    executionId,
    matrixId,
    startedAt: wallStartMs,
    completedAt: wallStartMs + Math.round(lastTUs / 1000),
    stepRecords,
  };

  return {
    executionId,
    matrixId,
    eventLog,
    finalPayload: { ...payload },
    hasErrors,
  };
}
