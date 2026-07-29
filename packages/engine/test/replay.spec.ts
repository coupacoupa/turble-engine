import { describe, expect, it } from 'vitest';
import {
  compileMatrix,
  createDeterministicHost,
  createReplay,
  evaluateMatrix,
  executeMatrixSync,
  toLegacyExecutionResult,
} from '../src';
import { approvedInput, creditOriginationMatrix } from './fixtures/credit-origination';

function sampleLog() {
  const { plan } = compileMatrix(creditOriginationMatrix);
  return executeMatrixSync(plan!, approvedInput, { host: createDeterministicHost({ wallStartMs: 1_700_000_000_000 }) });
}

describe('createReplay', () => {
  it('final state equals the execution final payload', () => {
    const log = sampleLog();
    const replay = createReplay(log);
    const legacy = toLegacyExecutionResult(log);
    expect(replay.finalState()).toEqual(legacy.finalPayload);
    expect(replay.stateAtSeq(log.events.length - 1)).toEqual(legacy.finalPayload);
  });

  it('reconstructs intermediate state at any seq', () => {
    const log = sampleLog();
    const replay = createReplay(log);

    // Before any event: empty
    expect(replay.stateAtSeq(-1)).toEqual({});

    // After execution_started (seq 0): exactly the input
    expect(replay.stateAtSeq(0)).toEqual(approvedInput);

    // Right after the isAuthorized mutation: input + isAuthorized, nothing later
    const authSeq = log.events.find((e) => e.type === 'payload_mutated' && e.key === 'isAuthorized')!.seq;
    const state = replay.stateAtSeq(authSeq);
    expect(state['isAuthorized']).toBe(true);
    expect(state['riskResult']).toBeUndefined();
  });

  it('scrubbing is consistent across checkpoint boundaries', () => {
    const log = sampleLog();
    const replay = createReplay(log);
    // Walk every seq and verify monotonic key growth (mutations only add keys here)
    let prevKeys = 0;
    for (let seq = 0; seq < log.events.length; seq++) {
      const keys = Object.keys(replay.stateAtSeq(seq)).length;
      expect(keys).toBeGreaterThanOrEqual(prevKeys);
      prevKeys = keys;
    }
  });
});

describe('toLegacyExecutionResult parity', () => {
  it('produces one step record per executed cell with snapshots', () => {
    const log = sampleLog();
    const result = toLegacyExecutionResult(log);
    const records = result.eventLog.stepRecords;

    expect(records).toHaveLength(4); // 4 configured cells in execution order
    expect(records.map((r) => r.stepIndex)).toEqual([0, 1, 2, 3]);
    expect(records.map((r) => r.colId)).toEqual(['col_ingest', 'col_audit', 'col_underwrite', 'col_underwrite']);
    expect(records[0]!.colLabel).toBe('1. Application Ingest');

    // Snapshot folding: each step's initial payload is the previous step's final payload
    for (let i = 1; i < records.length; i++) {
      expect(records[i]!.initialPayload).toEqual(records[i - 1]!.finalPayload);
    }
    expect(records[0]!.initialPayload).toEqual(approvedInput);
    expect(records[records.length - 1]!.finalPayload).toEqual(result.finalPayload);
  });

  it('cell results carry mutations, matched rules, latency and emitted events', () => {
    const result = toLegacyExecutionResult(sampleLog());
    const audit = result.eventLog.stepRecords.find((r) => r.cellResults[0]?.cellId === 'cell_bureau_audit')!;
    const cell = audit.cellResults[0]!;

    expect(cell.action).toBe('table_rule');
    expect(cell.status).toBe('success');
    expect(cell.mutatedPayload).toEqual({ riskResult: 'PASS_SCORECARD', maxLimit: 25000 });
    expect(cell.matchedRules).toEqual([0]);
    expect(cell.latencyMs).toBeGreaterThanOrEqual(1);
    expect(audit.emittedEvents).toHaveLength(1);
    expect(audit.emittedEvents[0]!.eventName).toBe('SCORECARD_APPROVED');
    expect(audit.emittedEvents[0]!.rowId).toBe('row_bureau');
  });

  it('timestamps derive from wall start + monotonic offset', () => {
    const result = toLegacyExecutionResult(sampleLog());
    expect(result.eventLog.startedAt).toBe(1_700_000_000_000);
    for (const rec of result.eventLog.stepRecords) {
      expect(rec.timestamp).toBeGreaterThanOrEqual(1_700_000_000_000);
    }
    expect(result.eventLog.completedAt).toBeGreaterThanOrEqual(result.eventLog.startedAt);
  });
});

describe('evaluateMatrix convenience API', () => {
  it('runs end to end without options', () => {
    const result = evaluateMatrix(creditOriginationMatrix, approvedInput);
    expect(result.hasErrors).toBe(false);
    expect(result.finalPayload['approvalStatus']).toBe('APPROVED');
    expect(result.executionId).toBeTruthy();
    expect(result.diagnostics?.some((d) => d.code === 'UNSUPPORTED_ACTION')).toBe(true);
  });

  it('returns diagnostics instead of throwing on compile errors', () => {
    const broken = JSON.parse(JSON.stringify(creditOriginationMatrix));
    broken.cells['row_bureau:col_underwrite'].expressionConfig.expression = '1 +++';
    const result = evaluateMatrix(broken, approvedInput);
    expect(result.hasErrors).toBe(true);
    expect(result.eventLog.stepRecords).toHaveLength(0);
    expect(result.diagnostics?.some((d) => d.severity === 'error')).toBe(true);
  });
});
