import { describe, expect, it } from "vitest";
import {
  compileMatrix,
  createDeterministicHost,
  executeMatrixSync,
  MatrixSchema,
  toLegacyExecutionResult,
} from "../src";
import {
  approvedInput,
  creditOriginationMatrix,
  declinedInput,
} from "./fixtures/credit-origination";

function runSample(input: Record<string, unknown>) {
  const { plan } = compileMatrix(creditOriginationMatrix);
  return executeMatrixSync(plan!, input, { host: createDeterministicHost() });
}

describe("executeMatrixSync", () => {
  it("approves the good applicant end to end", () => {
    const log = runSample(approvedInput);
    const result = toLegacyExecutionResult(log);

    expect(result.hasErrors).toBe(false);
    expect(result.finalPayload).toMatchObject({
      isAuthorized: true,
      riskResult: "PASS_SCORECARD",
      maxLimit: 25000,
      approvalStatus: "APPROVED",
    });
  });

  it("declines the weak applicant via the TEL expression", () => {
    const log = runSample(declinedInput);
    const result = toLegacyExecutionResult(log);

    expect(result.finalPayload["riskResult"]).toBeUndefined();
    expect(result.finalPayload["approvalStatus"]).toBe("DECLINED");
  });

  it("emits rule_evaluated with per-condition observability", () => {
    const log = runSample(declinedInput);
    const ruleEvents = log.events.filter((e) => e.type === "rule_evaluated");
    // Auth rule matched, scorecard rule did not
    const scorecard = ruleEvents.find(
      (e) =>
        e.type === "rule_evaluated" &&
        e.conditionResults.some((c) => c.key === "creditScore"),
    );
    expect(scorecard).toBeDefined();
    if (scorecard?.type === "rule_evaluated") {
      expect(scorecard.matched).toBe(false);
      const cs = scorecard.conditionResults.find(
        (c) => c.key === "creditScore",
      )!;
      expect(cs.expected).toBe(">= 700");
      expect(cs.actual).toBe(650);
      expect(cs.pass).toBe(false);
      const dti = scorecard.conditionResults.find((c) => c.key === "dti")!;
      expect(dti.pass).toBe(false);
    }
  });

  it("actually emits rule emitEvent (fixed vs legacy evaluator)", () => {
    const log = runSample(approvedInput);
    const emitted = log.events.filter((e) => e.type === "event_emitted");
    expect(emitted).toHaveLength(1);
    if (emitted[0]?.type === "event_emitted") {
      expect(emitted[0].eventName).toBe("SCORECARD_APPROVED");
      expect(emitted[0].payload).toEqual({ tier: "GOLD" });
    }
  });

  it("skips unsupported actions visibly", () => {
    const log = runSample(approvedInput);
    const skipped = log.events.filter((e) => e.type === "action_skipped");
    expect(
      skipped.some(
        (e) =>
          e.type === "action_skipped" &&
          e.reason === "unsupported" &&
          e.actionType === "trigger_sub_workflow",
      ),
    ).toBe(true);
  });

  it("records payload mutations as deltas with before/after", () => {
    const log = runSample(approvedInput);
    const mutations = log.events.filter((e) => e.type === "payload_mutated");
    const auth = mutations.find(
      (e) => e.type === "payload_mutated" && e.key === "isAuthorized",
    );
    expect(auth).toBeDefined();
    if (auth?.type === "payload_mutated") {
      expect(auth.before).toBe(null);
      expect(auth.after).toBe(true);
      expect(auth.source.cellId).toBe("cell_auth_ingest");
      expect(auth.source.ruleIdx).toBe(0);
    }
  });

  it("is deterministic: identical logs for identical runs", () => {
    const a = runSample(approvedInput);
    const b = runSample(approvedInput);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("maintains well-formed span nesting", () => {
    const log = runSample(approvedInput);
    const spanIds = new Set(log.events.map((e) => e.spanId));
    for (const e of log.events) {
      if (e.parentSpanId) expect(spanIds.has(e.parentSpanId)).toBe(true);
    }
    // seq is dense and ordered
    log.events.forEach((e, i) => expect(e.seq).toBe(i));
  });
});

describe("execution semantics details", () => {
  const base: MatrixSchema = {
    id: "m_sem",
    name: "semantics",
    version: "1",
    columns: [{ id: "c1", label: "C1", order: 0 }],
    rows: [{ id: "r1", label: "R1", order: 0, type: "standard" }],
    cells: {},
  };

  it("all_matches applies every matching rule in order (later wins)", () => {
    const matrix: MatrixSchema = {
      ...base,
      cells: {
        "r1:c1": {
          id: "cell_all",
          rowId: "r1",
          colId: "c1",
          actions: [
            {
              id: "a1",
              order: 0,
              type: "table_rule",
              enabled: true,
              tableRuleConfig: {
                hitPolicy: "all_matches",
                rules: [
                  { conditions: {}, mutations: { tier: "BRONZE", bonus: "1" } },
                  { conditions: {}, mutations: { tier: "SILVER" } },
                  {
                    conditions: { never: "== nope" },
                    mutations: { tier: "GOLD" },
                  },
                ],
              },
            },
          ],
        },
      },
    };
    const { plan } = compileMatrix(matrix);
    const log = executeMatrixSync(
      plan!,
      {},
      { host: createDeterministicHost() },
    );
    const result = toLegacyExecutionResult(log);
    expect(result.finalPayload).toMatchObject({ tier: "SILVER", bonus: 1 });
  });

  it("first_match stops after the first matching rule", () => {
    const matrix: MatrixSchema = {
      ...base,
      cells: {
        "r1:c1": {
          id: "cell_first",
          rowId: "r1",
          colId: "c1",
          actions: [
            {
              id: "a1",
              order: 0,
              type: "table_rule",
              enabled: true,
              tableRuleConfig: {
                rules: [
                  { conditions: {}, mutations: { tier: "BRONZE" } },
                  { conditions: {}, mutations: { tier: "SILVER" } },
                ],
              },
            },
          ],
        },
      },
    };
    const { plan } = compileMatrix(matrix);
    const log = executeMatrixSync(
      plan!,
      {},
      { host: createDeterministicHost() },
    );
    expect(toLegacyExecutionResult(log).finalPayload["tier"]).toBe("BRONZE");
  });

  it("disabled cells are skipped with a visible event", () => {
    const matrix: MatrixSchema = {
      ...base,
      cells: {
        "r1:c1": {
          id: "cell_off",
          rowId: "r1",
          colId: "c1",
          enabled: false,
          actions: [
            {
              id: "a1",
              order: 0,
              type: "table_rule",
              enabled: true,
              tableRuleConfig: {
                rules: [{ conditions: {}, mutations: { hit: "true" } }],
              },
            },
          ],
        },
      },
    };
    const { plan } = compileMatrix(matrix);
    const log = executeMatrixSync(
      plan!,
      {},
      { host: createDeterministicHost() },
    );
    expect(
      log.events.some(
        (e) => e.type === "cell_skipped" && e.reason === "disabled",
      ),
    ).toBe(true);
    expect(toLegacyExecutionResult(log).finalPayload["hit"]).toBeUndefined();
    // Skipped cells produce no step record (legacy parity)
    expect(toLegacyExecutionResult(log).eventLog.stepRecords).toHaveLength(0);
  });

  it("expression runtime errors mark the cell failed but execution continues", () => {
    const matrix: MatrixSchema = {
      ...base,
      columns: [
        { id: "c1", label: "C1", order: 0 },
        { id: "c2", label: "C2", order: 1 },
      ],
      cells: {
        "r1:c1": {
          id: "cell_boom",
          rowId: "r1",
          colId: "c1",
          action: "expression",
          expressionConfig: { expression: "1 < 'x'", outputVariable: "boom" },
        },
        "r1:c2": {
          id: "cell_after",
          rowId: "r1",
          colId: "c2",
          action: "table_rule",
          tableRuleConfig: {
            rules: [{ conditions: {}, mutations: { reached: "true" } }],
          },
        },
      },
    };
    const { plan } = compileMatrix(matrix);
    const log = executeMatrixSync(
      plan!,
      {},
      { host: createDeterministicHost() },
    );
    const result = toLegacyExecutionResult(log);
    expect(result.hasErrors).toBe(true);
    expect(result.finalPayload["reached"]).toBe(true);
    const failedStep = result.eventLog.stepRecords.find(
      (s) => s.cellResults[0]?.cellId === "cell_boom",
    )!;
    expect(failedStep.cellResults[0]?.status).toBe("fail");
    expect(failedStep.cellResults[0]?.error).toBeTruthy();
  });

  it("event_emitter actions emit", () => {
    const matrix: MatrixSchema = {
      ...base,
      cells: {
        "r1:c1": {
          id: "cell_emit",
          rowId: "r1",
          colId: "c1",
          action: "event_emitter",
          eventEmitterConfig: { eventName: "PING", eventPayload: { n: 1 } },
        },
      },
    };
    const { plan } = compileMatrix(matrix);
    const log = executeMatrixSync(
      plan!,
      {},
      { host: createDeterministicHost() },
    );
    expect(
      log.events.some(
        (e) => e.type === "event_emitted" && e.eventName === "PING",
      ),
    ).toBe(true);
  });

  it("capture: 'none' omits payload values from events", () => {
    const { plan } = compileMatrix(creditOriginationMatrix);
    const log = executeMatrixSync(plan!, approvedInput, {
      host: createDeterministicHost(),
      capture: "none",
    });
    const started = log.events[0]!;
    if (started.type === "execution_started")
      expect(started.input).toBeUndefined();
    const mutation = log.events.find((e) => e.type === "payload_mutated")!;
    if (mutation.type === "payload_mutated") {
      expect(mutation.before).toBeUndefined();
      expect(mutation.after).toBeUndefined();
      expect(mutation.key).toBeTruthy(); // keys still observable
    }
  });
});
