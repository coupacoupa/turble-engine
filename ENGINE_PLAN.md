# Turble Engine — Execution Engine Plan

Target: a fast, observable, deterministic matrix-execution engine. TypeScript first
(shared by web simulator + backend), designed from day one so a Rust implementation
can replace it behind the same contract.

> **Status (2026-07-29): Phase 1 (§13) is implemented** in `packages/engine` — TEL,
> compile + diagnostics (incl. legacy-JS expression auto-migration), event-sourced
> interpreter (table_rule both hit policies + emitEvent, expression, event_emitter),
> replay + legacy projection, conformance goldens (`test/fixtures/golden/`), and the
> web simulator now runs on it. Next: Phase 2 (effects, sub-workflows, backend wiring).

---

## 1. Current state (what the UI already promises)

### 1.1 The cell model (from the UI)

A **cell** is a coordinate `rowId:colId` holding an **ordered list of actions**
(`CellActionItem[]`), edited in `cell-editor-modal`:

- **Normalization**: `getCellActions()` (`apps/web/src/utils/cell-actions.util.ts`) is the
  single source of truth. Modern cells store `actions[]` (authoritative even when empty);
  legacy cells store a single `action` + config. `passthrough` = no behavior.
- **Action types**: standard rows → `table_rule` (the only one the editor offers today;
  `expression`, `api_call`, `event_emitter` exist in types/proto but have no editor UI and
  are not executed). Workflow rows → `trigger_sub_workflow` / `override_sub_workflow` /
  `skip_sub_workflow` with `inputMapping` / `outputMapping`.
- **Explicit dataflow contract**: every action declares `inputs[]` and `outputs[]`.
  The editor + `WorkflowValidationService` enforce:
  - an input must be _resolved_ — defined in `matrix.inputs`, or produced by a preceding
    action in the same cell, or by a preceding cell in execution order;
  - an output must not _clash_ — shadow a workflow input or a preceding cell's output.
- **Table rule shape**: `conditions: Record<key, conditionString>` (`>= 700`, `== valid`,
  empty = wildcard), `mutations: Record<key, value>` (strings coerced to bool/number),
  optional `emitEvent`. Hit policy `first_match` implemented; `all_matches` declared but
  **not implemented**.
- Declared but semantically undefined: `StepColumnSchema.isAsync`, `DomainRowSchema.isInterceptor`.

### 1.2 The testing simulator (what observability must feed)

The simulator is entirely **snapshot-driven** off `MatrixExecutionResult`:

- `test-inputs-modal` / bottom panel: form+JSON payload entry, multi test-case tabs,
  run → full execution → final payload.
- `test-execution-inspector-modal` + `execution-inspector-bottom-panel`: a step timeline
  (one entry per executed cell), variable snapshot at a step, pinned variables, search,
  hover → highlights the cell on the sheet.
- `time-travel-bar`: slider + step back/next + play, shows payload snapshot at the step.
- All of it indexes into `ReplayEventLog.stepRecords[]`, where each record carries
  **full deep copies** of `initialPayload` and `finalPayload` plus `cellResults`.

### 1.3 Gaps the engine must close

| Gap                                                                                                                    | Where                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Only `table_rule` actually executes; `expression`, `api_call`, `event_emitter`, sub-workflows are dead paths           | `local-matrix-evaluator.service.ts`                          |
| `emitEvent` on rules is never emitted (`emittedEvents` always `[]`)                                                    | local evaluator                                              |
| Expression config stores **raw JS** (`payload.riskResult === '...' ? ...`) — unevaluatable safely, unportable to Rust  | seed data / types                                            |
| Condition strings re-parsed ad hoc on every rule, every run                                                            | `evaluateCondition()`                                        |
| Full payload cloned twice per cell → O(cells × payload) memory & GC pressure                                           | local evaluator                                              |
| "Step" is named per-column (`colLabel`, `StepEvaluationRecord`) but recorded per-cell — granularity is muddled         | types + evaluator                                            |
| Backend handler is a hardcoded stub; client silently falls back to the (different) local engine — two divergent truths | `matrix-evaluator.handler.ts`, `matrix-evaluator.service.ts` |
| Validation logic (input resolution / output clash) lives only in the frontend; engine doesn't enforce it               | `workflow-validation.service.ts`                             |
| No error semantics: everything is `status: 'success'`, `hasErrors: false` hardcoded                                    | everywhere                                                   |

---

## 2. Goals / non-goals

**Goals**

1. **One engine, everywhere**: a pure TS package (`packages/engine`) with zero runtime deps,
   running identically in the browser (simulator) and Node (backend RPC). Kills the
   local-vs-backend divergence.
2. **Fast**: compile-once / execute-many, no per-step deep clones, pre-parsed conditions.
3. **Observable**: append-only execution event log as the _single source of truth_;
   everything the simulator shows is a projection of it. Span model maps 1:1 to
   OpenTelemetry for production.
4. **Deterministic & replayable**: same plan + same input + same recorded effects
   → byte-identical event log. This is what makes time travel and the Rust port testable.
5. **Rust-ready**: semantics defined as a spec + language-agnostic conformance fixtures,
   not as "whatever the TS code does".

**Non-goals (v1)**

- Persistence/durability of executions (in-memory log; serialization format defined, storage later).
- Parallel/async column execution (semantics reserved, see §11).
- A general scripting language in cells.

---

## 3. Architecture

```
packages/engine/
  src/
    schema/        MatrixSchema types + normalization (getCellActions moves here)
    compile/       validate → normalize → order → parse conditions/expressions → ExecutionPlan
    exec/          interpreter loop (pure, sync core; async only at effect boundaries)
    events/        event types, EventSink, sequence/causality
    replay/        fold(events) → state-at-seq, projections (stepRecords, timeline, snapshots)
    host/          HostEnvironment interface + default impls (mock fetch, clock, ids)
    lang/          Turble Expression Language: lexer, Pratt parser, AST, evaluator
  test/
    conformance/   *.json golden fixtures: {matrix, input, effects} → {events}
    bench/         vitest bench micro-benchmarks
```

Layering rule: `exec` never touches the network, clock, or randomness directly —
everything goes through `HostEnvironment`. The core is a **pure function**:

```
execute(plan, input, recordedEffects?) → EventLog
```

The web app and backend both consume this package; `LocalMatrixEvaluatorService` and the
stub handler are deleted.

---

## 4. Execution semantics (the spec)

This section becomes the normative document the Rust port is written against.

1. **Ordering**: columns sorted by `order` asc (outer loop); rows sorted by `order` asc
   (inner loop); within a cell, actions by `order` asc; within a `table_rule`, rules by
   array index. Ties broken by id lexicographic (must be specified for determinism).
2. **Skip rules**: missing cell → skipped silently; `cell.enabled === false` or
   `action.enabled === false` → `CellSkipped`/`ActionSkipped` event (visible, unlike today).
3. **Context**: a single logical `payload` (string key → Value). Mutations apply
   immediately and are visible to every subsequent action/cell (matches validator's
   "preceding in execution order" definition).
4. **Value model** (critical for Rust parity): JSON values only — `null | bool | f64 |
string | array | object`. No `undefined`, no functions, no Date. Number = IEEE-754 f64.
   Mutation coercion (`"true"`→true, numeric strings→number) happens at **compile time**
   on literals, not at runtime.
5. **Hit policies**: `first_match` (default) and `all_matches` (apply every matching rule
   in order; later mutations win) — both implemented.
6. **Sub-workflows**: child plan resolved at compile time via a `PlanRegistry`;
   `inputMapping` projects parent payload → child input; child runs to completion under
   the same event log (nested spans); `outputMapping` projects child output → parent
   payload. `skip_sub_workflow` emits `ActionSkipped`. Cycle detection + max depth
   (default 8) at compile time.
7. **Interceptor rows** (`isInterceptor`): reserved semantic — an interceptor cell whose
   table rule sets a designated control key (e.g. `__halt`) short-circuits the remainder
   of the execution with `ExecutionHalted`. (v1: flag parsed, halt key TBD — see §12.)

---

## 5. Compile phase (the performance win)

`compile(matrix, registry) → { plan } | { diagnostics }`

- Normalize legacy cells (single `action`) → `actions[]` once.
- Sort columns/rows once; build a **flat array** of `PlannedCell { rowIdx, colIdx,
actions: PlannedAction[] }` in execution order — the hot loop iterates one array,
  no map lookups, no re-sorting.
- Parse every condition string and expression into an AST **once**; conditions compile to
  closures (TS) / enum tree (Rust).
- Intern payload keys to integer slots; the runtime payload is a slot array + key table
  (object projection only materialized for events/output).
- Run all validation here — port `WorkflowValidationService` logic (input resolution,
  output clash) into engine diagnostics so UI and engine share one truth. UI keeps calling
  it for live editor feedback via the same exported functions.
- Diagnostics have codes (`UNRESOLVED_INPUT`, `OUTPUT_CLASH`, `BAD_CONDITION_SYNTAX`,
  `SUBWORKFLOW_CYCLE`, …), severity, and cell/action/rule coordinates → drives the
  validation modal.
- Plans cached by `(matrix.id, matrix.version, contentHash)`.

---

## 6. Event sourcing (the observability core)

Append-only log; every event: `{ seq, spanId, parentSpanId, tMonotonicUs }`
(wall-clock only on `ExecutionStarted`). Taxonomy:

```
ExecutionStarted   { executionId, matrixId, planHash, input }
ColumnStarted      { colId, colIdx }            / ColumnCompleted
CellStarted        { cellId, rowId, colId }     / CellCompleted { status, latencyUs }
CellSkipped        { reason: 'disabled' | 'empty' }
ActionStarted      { actionId, type }           / ActionCompleted / ActionSkipped / ActionFailed { error }
RuleEvaluated      { ruleIdx, matched, conditionResults: [{key, op, expected, actual, pass}] }
PayloadMutated     { key, before, after, source: {cellId, actionId, ruleIdx?} }
EventEmitted       { eventName, payload }
EffectRequested    { effectId, kind: 'http', request }
EffectResolved     { effectId, outcome, latencyUs }
SubWorkflowStarted { childMatrixId, mappedInput } / SubWorkflowCompleted { mappedOutput }
ExecutionCompleted { finalPayload } | ExecutionFailed { error } | ExecutionHalted { by }
```

Design points:

- **Deltas, not snapshots**: `PayloadMutated` carries `{key, before, after}` only. State at
  any seq = fold of mutations up to seq. This removes the two-full-clones-per-cell cost and
  gives the time-travel slider _finer_ granularity than it has today (per-rule, per-key).
- **`RuleEvaluated.conditionResults`** is the observability jackpot for the simulator:
  "why did rule 3 not match?" → show each condition's expected vs actual, pass/fail.
  The current UI can't answer that at all.
- **Snapshots for seek**: replay keeps a payload checkpoint every N events (N≈256) so
  slider scrubbing on huge logs is O(N) not O(seq).
- **Projections** (in `replay/`):
  - `toStepRecords(log)` → the existing `StepEvaluationRecord[]` / `MatrixExecutionResult`
    shape, so **every current simulator component works unchanged on day one**;
  - `stateAtSeq(log, n)` → payload snapshot for time travel;
  - `timeline(log)` → per-cell/per-action spans with timings (future flame view);
  - later: OTLP export (spanId/parentSpanId map directly onto OTel spans).
- **Streaming**: `execute()` takes an `EventSink`; a collector sink builds the log, a
  streaming sink feeds the existing `StreamExecutionSteps` RPC and a future live UI mode.
- **Capture policy**: `{ payloadValues: 'full' | 'redacted' | 'none' }` per run —
  full for the simulator, configurable for prod (PII / log size).

---

## 7. Effects & host interface (determinism boundary)

```ts
interface HostEnvironment {
  now(): number; // monotonic µs
  wallClock(): number; // epoch ms, ExecutionStarted only
  newId(scope: string): string; // seeded, deterministic in tests
  http(req: HttpEffectRequest): Promise<HttpEffectResult>; // api_call
  emit(event: EmittedEvent): void; // event_emitter (side channel)
}
```

- The simulator injects a **mock host**: fixed clock, seeded ids, and per-test-case
  scripted HTTP responses (a natural extension of the multi-test-case tabs: each test case
  can carry effect stubs).
- **Record/replay**: every effect result is recorded as `EffectResolved`. Replaying a log
  never re-fires effects — it reads them back. Same mechanism makes runs with external
  calls reproducible and makes the TS↔Rust conformance suite possible for `api_call`.
- Core stays sync-fast: the interpreter is synchronous between effect boundaries; `execute`
  is async only because `http` is.

---

## 8. Expression & condition language ("TEL")

Current expressions are raw JS strings — unsafe to eval and impossible to port. Replace
with one tiny deterministic language used for _both_ rule conditions and `expression`
actions, specified with a grammar + fixture suite:

- Literals: numbers, strings, booleans, null. Identifiers resolve to payload keys.
- Operators: `== != < <= > >= && || ! + - * / %`, ternary `? :`, `in`, string `contains`.
- Condition cells keep their shorthand (`>= 700`, `== valid`, empty = wildcard) — compiled
  by desugaring to TEL (`>= 700` → `$self >= 700`); current loose semantics
  (case-insensitive string equality, `'true'` string ↔ bool) are preserved by explicit,
  spec'd coercion rules, not accident.
- Implementation: hand-written lexer + Pratt parser (~300 lines), AST evaluated against
  the slot-based payload. Identical AST + semantics re-implemented in Rust; grammar and
  ~100 expression fixtures are the contract.
- Rejected alternatives: `eval`/`Function` (unsafe, unportable), JSONLogic (hostile to
  humans in a table cell), CEL (great semantics but heavyweight; TEL can converge toward a
  CEL subset if we ever want to swap).

---

## 9. Error semantics

- `ActionFailed` (bad expression at runtime, effect error/timeout, mapping failure) →
  policy per action: `onError: 'fail' | 'skip' | 'halt'` (default `fail` = mark cell
  `fail`, continue execution; `halt` = stop run with `ExecutionFailed`).
- Missing required workflow input → compile-time diagnostic if statically known, else
  `ExecutionFailed` at start.
- Effect timeout budget per `api_call` (host-enforced, default 10s) + per-execution wall
  budget.
- `hasErrors` in the result becomes real: any `ActionFailed` in the log.

---

## 10. Performance plan

Targets (mid-tier laptop, sync-only matrix):

- compile: 1k-cell matrix < 5 ms;
- execute: 10k cell-action evaluations < 10 ms, zero allocations per non-matching rule
  beyond its `RuleEvaluated` event;
- replay scrub: `stateAtSeq` < 1 ms at any position on a 100k-event log (via snapshots).

Tactics: compile-once plan cache; flat execution array; interned key slots; pre-parsed
ASTs; delta events instead of clones; chunked event buffer (no giant array re-allocs);
event objects as plain monomorphic shapes (hidden-class friendly). `vitest bench` suite in
CI so regressions are visible. When this ceiling is hit, the Rust engine is the next
gear — not more TS cleverness.

---

## 11. Public API sketch

```ts
// compile
const compiled = compileMatrix(matrix, { registry }); // diagnostics | plan
// run
const log = await executeMatrix(compiled.plan, input, {
  host,
  sink,
  capture: "full",
});
// project for the existing UI
const result: MatrixExecutionResult = toLegacyExecutionResult(log);
// time travel
const replay = createReplay(log);
replay.stateAtSeq(n);
replay.eventCount;
replay.spans();
```

Integration:

- **web**: `matrix-evaluator.service.ts` calls `compileMatrix` + `executeMatrix` directly
  (in-browser) — the RPC becomes optional, not a silently-diverging fallback.
- **backend**: handler runs the same package; `StreamExecutionSteps` streams real events
  via a streaming sink; proto gains an `ExecutionEvent` message so the wire format matches
  the log (additive change).

## 12. Testing & the Rust bridge

1. **Conformance fixtures** (the centerpiece): JSON files
   `{ matrix, input, effectScript } → expected event log` (normalized: no timestamps).
   The TS engine generates them; both engines must reproduce them byte-for-byte.
2. Unit tests per layer (lang fixtures, compile diagnostics, replay folds).
3. Property tests: random matrices → invariants (event nesting well-formed; fold of
   mutations == finalPayload; toStepRecords total mutations == payload diff).
4. **Rust port path**: `crates/turble-engine` implements the same spec; runs the same
   fixtures; exposed two ways — native lib for the backend, **wasm build for the browser**
   so even the in-browser simulator eventually runs the real Rust engine. The proto package
   already gives serialization; add `execution_event.proto`.

## 13. Roadmap

- **Phase 1 — core engine (TS)**: `packages/engine` scaffold; schema normalization moved
  in; TEL parser/eval; compile phase + diagnostics (port validation service); interpreter
  for `table_rule` (both hit policies, `emitEvent` actually emitted) + `expression`;
  event log + `toLegacyExecutionResult`; wire web simulator to it; conformance fixtures
  seeded from the credit-origination sample.
- **Phase 2 — effects & composition**: `HostEnvironment`, `api_call` (mock host in
  simulator, real fetch in backend), `event_emitter`, sub-workflow execution with
  mappings/overrides/skip, error semantics; backend handler runs the real engine;
  streaming RPC streams real events.
- **Phase 3 — observability & speed**: replay snapshots, per-condition rule inspector UI,
  live-streaming mode in simulator, effect-stubbing UI per test case, bench suite,
  capture policies, OTel exporter in backend.
- **Phase 4 — Rust**: freeze spec + fixtures; `turble-engine` crate; wasm + native
  bindings; swap behind the same proto/API.

## 14. Open decisions (recommendations inline)

1. **Step granularity shown in the simulator** — keep per-cell steps as default projection
   (matches current UI), expose per-event scrubbing in the time-travel bar (recommended).
2. **Interceptor halt semantics** — reserved control key vs explicit action type;
   recommend a dedicated `halt` mutation target (`__halt: reason`) emitted by table rules.
3. **`isAsync` columns** — recommend: v1 executes them synchronously but tags spans;
   real async (parallel rows within a column, barrier at column end) only after Rust port.
4. **Legacy raw-JS expressions in existing saved workflows** — recommend compile-time
   diagnostic + best-effort auto-migration to TEL (the seed example translates 1:1).
