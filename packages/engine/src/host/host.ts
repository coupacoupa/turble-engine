/**
 * The determinism boundary. The engine core never touches the clock or
 * randomness directly — everything comes through the host. Injecting a
 * deterministic host makes two runs of the same plan + input produce
 * byte-identical event logs (the basis of replay and conformance testing).
 */
export interface HostEnvironment {
  /** Monotonic clock in microseconds. Only deltas are meaningful. */
  now(): number;
  /** Wall clock (epoch ms). Recorded once, on ExecutionStarted. */
  wallClock(): number;
  /** Generate an id. `scope` hints usage: 'exec' | 'span'. */
  newId(scope: string): string;
}

/** Real clock + random ids, for interactive use. */
export function createDefaultHost(): HostEnvironment {
  const hasPerf =
    typeof performance !== "undefined" && typeof performance.now === "function";
  return {
    now: hasPerf
      ? () => Math.round(performance.now() * 1000)
      : () => Date.now() * 1000,
    wallClock: () => Date.now(),
    newId: (scope) =>
      `${scope}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  };
}

/**
 * Fully deterministic host: the clock advances a fixed step per call and ids
 * are per-scope counters. Used by tests and conformance fixtures.
 */
export function createDeterministicHost(opts?: {
  tickUs?: number;
  wallStartMs?: number;
}): HostEnvironment {
  const tick = opts?.tickUs ?? 10;
  const wall = opts?.wallStartMs ?? 0;
  let clock = 0;
  const counters = new Map<string, number>();
  return {
    now: () => (clock += tick),
    wallClock: () => wall,
    newId: (scope) => {
      const n = (counters.get(scope) ?? 0) + 1;
      counters.set(scope, n);
      return `${scope}_${n}`;
    },
  };
}
