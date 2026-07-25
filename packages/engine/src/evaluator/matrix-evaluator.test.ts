import { describe, it, expect } from 'vitest';
import { MatrixSchema } from '../types/matrix.types';
import { MatrixEvaluatorEngine } from './matrix-evaluator.engine';
import { TimeTravelReplayService } from '../telemetry/time-travel-replay.service';

describe('Turble 2D Matrix Engine', () => {
  it('evaluates custom table rules sequentially across 2D matrix coordinates', async () => {
    const engine = new MatrixEvaluatorEngine();

    const matrix: MatrixSchema = {
      id: 'credit_origination_matrix',
      name: 'Credit Origination Scorecard',
      version: '1.0.0',
      columns: [
        { id: 'col_ingest', label: '1. Ingest', order: 0 },
        { id: 'col_audit', label: '2. Credit Audit', order: 1 },
        { id: 'col_underwrite', label: '3. Underwrite', order: 2 },
      ],
      rows: [
        { id: 'row_risk', label: 'Credit Risk Engine', order: 0, type: 'plain' },
        { id: 'row_dispatch', label: 'Dispatch Hub', order: 1, type: 'plain' },
      ],
      cells: {
        'row_risk:col_audit': {
          id: 'cell_risk_audit',
          rowId: 'row_risk',
          colId: 'col_audit',
          action: 'table_rule',
          tableRuleConfig: {
            rules: [
              {
                conditions: { creditScore: '>= 700', dti: '<= 0.35' },
                mutations: { riskResult: 'PASS_SCORECARD', approvedLimit: 25000 },
                emitEvent: { eventName: 'SCORECARD_PASSED', payload: { tier: 'GOLD' } },
              },
            ],
          },
        },
        'row_risk:col_underwrite': {
          id: 'cell_risk_underwrite',
          rowId: 'row_risk',
          colId: 'col_underwrite',
          action: 'expression',
          expressionConfig: {
            expression: "payload.riskResult === 'PASS_SCORECARD' ? 'APPROVED' : 'DECLINED'",
            outputVariable: 'approvalStatus',
          },
        },
      },
    };

    const initialPayload = { creditScore: 740, dti: 0.28 };
    const result = await engine.executeMatrix(matrix, initialPayload);

    expect(result.status).toBe('completed');
    expect(result.finalPayload.riskResult).toBe('PASS_SCORECARD');
    expect(result.finalPayload.approvedLimit).toBe(25000);
    expect(result.finalPayload.approvalStatus).toBe('APPROVED');
    expect(result.emittedEvents).toHaveLength(1);
    expect(result.emittedEvents[0]!.eventName).toBe('SCORECARD_PASSED');
  });

  it('executes global interceptor rows on every step transition', async () => {
    const engine = new MatrixEvaluatorEngine();

    const matrix: MatrixSchema = {
      id: 'interceptor_matrix',
      name: 'Interceptor Guard Matrix',
      version: '1.0.0',
      columns: [
        { id: 'col_1', label: 'Step 1', order: 0 },
        { id: 'col_2', label: 'Step 2', order: 1 },
      ],
      rows: [
        { id: 'row_interceptor', label: 'Auth Guard', order: 0, type: 'plain', isInterceptor: true },
        { id: 'row_main', label: 'Main Logic', order: 1, type: 'plain' },
      ],
      cells: {
        'row_interceptor:col_1': {
          id: 'cell_auth_1',
          rowId: 'row_interceptor',
          colId: 'col_1',
          action: 'table_rule',
          tableRuleConfig: {
            rules: [{ conditions: { token: '== valid' }, mutations: { authCheckedStep1: true } }],
          },
        },
        'row_interceptor:col_2': {
          id: 'cell_auth_2',
          rowId: 'row_interceptor',
          colId: 'col_2',
          action: 'table_rule',
          tableRuleConfig: {
            rules: [{ conditions: { token: '== valid' }, mutations: { authCheckedStep2: true } }],
          },
        },
      },
    };

    const result = await engine.executeMatrix(matrix, { token: 'valid' });

    expect(result.status).toBe('completed');
    expect(result.finalPayload.authCheckedStep1).toBe(true);
    expect(result.finalPayload.authCheckedStep2).toBe(true);
  });

  it('supports time-travel step replay debugging', async () => {
    const engine = new MatrixEvaluatorEngine();
    const replayService = new TimeTravelReplayService();

    const matrix: MatrixSchema = {
      id: 'replay_matrix',
      name: 'Replay Test',
      version: '1.0.0',
      columns: [
        { id: 'col_1', label: 'Step 1', order: 0 },
        { id: 'col_2', label: 'Step 2', order: 1 },
      ],
      rows: [{ id: 'row_1', label: 'Row 1', order: 0, type: 'plain' }],
      cells: {
        'row_1:col_1': {
          id: 'c1',
          rowId: 'row_1',
          colId: 'col_1',
          action: 'expression',
          expressionConfig: { expression: '10', outputVariable: 'step1Val' },
        },
        'row_1:col_2': {
          id: 'c2',
          rowId: 'row_1',
          colId: 'col_2',
          action: 'expression',
          expressionConfig: { expression: '20', outputVariable: 'step2Val' },
        },
      },
    };

    const result = await engine.executeMatrix(matrix, {});
    const step0Snapshot = replayService.replayUntilStep(result.eventLog, 0);

    expect(step0Snapshot.currentPayload.step1Val).toBe(10);
    expect(step0Snapshot.currentPayload.step2Val).toBeUndefined();

    const step1Snapshot = replayService.replayUntilStep(result.eventLog, 1);
    expect(step1Snapshot.currentPayload.step2Val).toBe(20);
  });
});
