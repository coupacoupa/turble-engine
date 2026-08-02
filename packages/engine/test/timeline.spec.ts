import { describe, expect, it } from "vitest";
import {
  compileMatrix,
  createDeterministicHost,
  createExecutionTimeline,
  executeMatrixSync,
  projectExecutionResult,
} from "../src";
import {
  approvedInput,
  creditOriginationMatrix,
} from "./fixtures/credit-origination";

function sampleLog() {
  const { plan } = compileMatrix(creditOriginationMatrix);
  return executeMatrixSync(plan!, approvedInput, {
    host: createDeterministicHost({ wallStartMs: 1_700_000_000_000 }),
  });
}

describe("createExecutionTimeline", () => {
  it("final state equals the execution final payload", () => {
    const log = sampleLog();
    const timeline = createExecutionTimeline(log);
    const projected = projectExecutionResult(log);
    expect(timeline.finalState()).toEqual(projected.finalPayload);
    expect(timeline.stateAtSeq(log.events.length - 1)).toEqual(
      projected.finalPayload,
    );
  });

  it("reconstructs intermediate state at any seq", () => {
    const log = sampleLog();
    const timeline = createExecutionTimeline(log);

    // Before any event: empty
    expect(timeline.stateAtSeq(-1)).toEqual({});

    // After execution_started (seq 0): exactly the input
    expect(timeline.stateAtSeq(0)).toEqual(approvedInput);

    // Right after the isAuthorized mutation: input + isAuthorized, nothing later
    const authSeq = log.events.find(
      (e) => e.type === "payload_mutated" && e.key === "isAuthorized",
    )!.seq;
    const state = timeline.stateAtSeq(authSeq);
    expect(state["isAuthorized"]).toBe(true);
    expect(state["riskResult"]).toBeUndefined();
  });

  it("scrubbing is consistent across checkpoint boundaries", () => {
    const log = sampleLog();
    const timeline = createExecutionTimeline(log);
    // Walk every seq and verify monotonic key growth (mutations only add keys here)
    let prevKeys = 0;
    for (let seq = 0; seq < log.events.length; seq++) {
      const keys = Object.keys(timeline.stateAtSeq(seq)).length;
      expect(keys).toBeGreaterThanOrEqual(prevKeys);
      prevKeys = keys;
    }
  });
});

describe("projectExecutionResult parity", () => {
  it("produces one step record per executed cell with snapshots", () => {
    const log = sampleLog();
    const result = projectExecutionResult(log);
    const records = result.eventLog.stepRecords;

    expect(records).toHaveLength(4); // 4 configured cells in execution order
    expect(records.map((r) => r.stepIndex)).toEqual([0, 1, 2, 3]);
    expect(records.map((r) => r.colId)).toEqual([
      "col_ingest",
      "col_audit",
      "col_underwrite",
      "col_underwrite",
    ]);
    expect(records[0]!.colLabel).toBe("1. Application Ingest");

    // Snapshot folding: each step's initial payload is the previous step's final payload
    for (let i = 1; i < records.length; i++) {
      expect(records[i]!.initialPayload).toEqual(records[i - 1]!.finalPayload);
    }
    expect(records[0]!.initialPayload).toEqual(approvedInput);
    expect(records[records.length - 1]!.finalPayload).toEqual(
      result.finalPayload,
    );
  });

  it("cell results carry mutations, matched rules, latency and emitted events", () => {
    const result = projectExecutionResult(sampleLog());
    const audit = result.eventLog.stepRecords.find(
      (r) => r.cellResults[0]?.cellId === "cell_bureau_audit",
    )!;
    const cell = audit.cellResults[0]!;

    expect(cell.action).toBe("table_rule");
    expect(cell.status).toBe("success");
    expect(cell.mutatedPayload).toEqual({
      riskResult: "PASS_SCORECARD",
      maxLimit: 25000,
    });
    expect(cell.matchedRules).toEqual([0]);
    expect(cell.latencyMs).toBeGreaterThan(0);
    expect(cell.emittedEvents).toHaveLength(1);
    expect(cell.emittedEvents![0]).toMatchObject({
      eventName: "SCORECARD_APPROVED",
      rowId: "row_bureau",
      colId: "col_audit",
      payload: { tier: "GOLD" },
    });
  });
});
