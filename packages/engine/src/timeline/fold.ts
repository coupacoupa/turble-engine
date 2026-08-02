import { ExecutionEvent, ExecutionLog } from "../events/types";
import { Value } from "../lang/value";

const CHECKPOINT_INTERVAL = 256;

/** Apply a single event to a payload state. Only mutation-bearing events matter. */
export function applyEvent(
  state: Record<string, Value>,
  event: ExecutionEvent,
): void {
  if (event.type === "execution_started" && event.input) {
    for (const [k, v] of Object.entries(event.input)) state[k] = v;
  } else if (event.type === "payload_mutated") {
    state[event.key] = event.after === undefined ? null : event.after;
  }
}

export interface ExecutionTimeline {
  readonly eventCount: number;
  /** Payload state after applying events [0..seq] inclusive. O(1) via checkpoints. */
  stateAtSeq(seq: number): Record<string, Value>;
  /** Final payload state. */
  finalState(): Record<string, Value>;
}

/** Backward compatibility alias */
export type Replay = ExecutionTimeline;

/**
 * Execution timeline projection. Requires a log captured with `capture: 'full'` —
 * without recorded values there is nothing to fold.
 *
 * Checkpoints every N events make timeline scrubbing O(N) instead of O(seq).
 */
export function createExecutionTimeline(log: ExecutionLog): ExecutionTimeline {
  const checkpoints: Array<{ seq: number; state: Record<string, Value> }> = [];
  const state: Record<string, Value> = {};

  for (let i = 0; i < log.events.length; i++) {
    if (i % CHECKPOINT_INTERVAL === 0) {
      checkpoints.push({ seq: i, state: { ...state } });
    }
    applyEvent(state, log.events[i]!);
  }
  const final = { ...state };

  return {
    eventCount: log.events.length,
    stateAtSeq(seq: number): Record<string, Value> {
      const clamped = Math.min(Math.max(seq, -1), log.events.length - 1);
      if (clamped < 0) return {};
      let ckptIdx = Math.min(
        Math.floor(clamped / CHECKPOINT_INTERVAL),
        checkpoints.length - 1,
      );
      // A checkpoint stores state BEFORE its seq — start from the one at or before clamped
      while (ckptIdx > 0 && checkpoints[ckptIdx]!.seq > clamped) ckptIdx--;
      const ckpt = checkpoints[ckptIdx]!;
      const out = { ...ckpt.state };
      for (let i = ckpt.seq; i <= clamped; i++) applyEvent(out, log.events[i]!);
      return out;
    },
    finalState: () => ({ ...final }),
  };
}

/** Alias for backward compatibility */
export const createReplay = createExecutionTimeline;
