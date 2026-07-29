import { describe, expect, it } from 'vitest';
import { compileMatrix, MatrixSchema } from '../src';
import { creditOriginationMatrix } from './fixtures/credit-origination';

function minimalMatrix(overrides: Partial<MatrixSchema>): MatrixSchema {
  return {
    id: 'm1',
    name: 'test',
    version: '1.0.0',
    columns: [{ id: 'c1', label: 'Col 1', order: 0 }],
    rows: [{ id: 'r1', label: 'Row 1', order: 0, type: 'standard' }],
    cells: {},
    ...overrides,
  };
}

describe('compileMatrix', () => {
  it('compiles the credit origination sample with an unsupported-action warning only', () => {
    const { plan, diagnostics } = compileMatrix(creditOriginationMatrix);
    expect(plan).toBeDefined();
    expect(diagnostics.every((d) => d.severity === 'warning')).toBe(true);
    expect(diagnostics.some((d) => d.code === 'UNSUPPORTED_ACTION')).toBe(true);
    // Execution order: column by column, then row by row
    expect(plan!.cells.map((c) => c.cellId)).toEqual([
      'cell_auth_ingest',
      'cell_bureau_audit',
      'cell_bureau_underwrite',
      'cell_notify_underwrite',
    ]);
  });

  it('orders columns/rows by order with id tie-break', () => {
    const matrix = minimalMatrix({
      columns: [
        { id: 'cb', label: 'B', order: 1 },
        { id: 'ca', label: 'A', order: 0 },
        { id: 'cc', label: 'C', order: 1 },
      ],
      rows: [{ id: 'r1', label: 'R', order: 0, type: 'standard' }],
      cells: {
        'r1:ca': { id: 'x_a', rowId: 'r1', colId: 'ca', actions: [] },
        'r1:cb': { id: 'x_b', rowId: 'r1', colId: 'cb', actions: [] },
        'r1:cc': { id: 'x_c', rowId: 'r1', colId: 'cc', actions: [] },
      },
    });
    const { plan } = compileMatrix(matrix);
    expect(plan!.cells.map((c) => c.colId)).toEqual(['ca', 'cb', 'cc']);
  });

  it('reports bad expression syntax as an error and returns no plan', () => {
    const matrix = minimalMatrix({
      cells: {
        'r1:c1': {
          id: 'bad',
          rowId: 'r1',
          colId: 'c1',
          action: 'expression',
          expressionConfig: { expression: '1 +', outputVariable: 'out' },
        },
      },
    });
    const { plan, diagnostics } = compileMatrix(matrix);
    expect(plan).toBeUndefined();
    expect(diagnostics.some((d) => d.code === 'BAD_EXPRESSION_SYNTAX' && d.severity === 'error')).toBe(true);
  });

  it('auto-migrates legacy raw-JS expressions to TEL with a warning', () => {
    const matrix = minimalMatrix({
      cells: {
        'r1:c1': {
          id: 'legacy',
          rowId: 'r1',
          colId: 'c1',
          action: 'expression',
          expressionConfig: {
            expression: "payload.riskResult === 'PASS_SCORECARD' ? 'APPROVED' : 'DECLINED'",
            outputVariable: 'approvalStatus',
          },
        },
      },
    });
    const { plan, diagnostics } = compileMatrix(matrix);
    expect(plan).toBeDefined();
    expect(diagnostics.some((d) => d.code === 'LEGACY_EXPRESSION_MIGRATED' && d.severity === 'warning')).toBe(true);
    const action = plan!.cells[0]!.actions[0]!;
    expect(action.kind).toBe('expression');
    if (action.kind === 'expression') {
      expect(action.source).toBe("riskResult == 'PASS_SCORECARD' ? 'APPROVED' : 'DECLINED'");
    }
  });

  it('warns on unresolved inputs and output clashes', () => {
    const matrix = minimalMatrix({
      inputs: [{ id: 'i1', key: 'givenInput', type: 'string' }],
      cells: {
        'r1:c1': {
          id: 'cell1',
          rowId: 'r1',
          colId: 'c1',
          actions: [
            {
              id: 'a1',
              order: 0,
              type: 'table_rule',
              enabled: true,
              inputs: ['givenInput', 'neverProduced'],
              outputs: ['givenInput'], // clashes with workflow input
              tableRuleConfig: { rules: [] },
            },
          ],
        },
      },
    });
    const { plan, diagnostics } = compileMatrix(matrix);
    expect(plan).toBeDefined(); // warnings don't block execution
    expect(diagnostics.some((d) => d.code === 'UNRESOLVED_INPUT' && d.key === 'neverProduced')).toBe(true);
    expect(diagnostics.some((d) => d.code === 'OUTPUT_CLASH' && d.key === 'givenInput')).toBe(true);
    expect(diagnostics.some((d) => d.code === 'UNRESOLVED_INPUT' && d.key === 'givenInput')).toBe(false);
  });

  it('resolves inputs produced by preceding cells in execution order', () => {
    const matrix = minimalMatrix({
      columns: [
        { id: 'c1', label: 'Col 1', order: 0 },
        { id: 'c2', label: 'Col 2', order: 1 },
      ],
      cells: {
        'r1:c1': {
          id: 'producer',
          rowId: 'r1',
          colId: 'c1',
          actions: [
            {
              id: 'a1',
              order: 0,
              type: 'table_rule',
              enabled: true,
              outputs: ['derived'],
              tableRuleConfig: { rules: [{ conditions: {}, mutations: { derived: '1' } }] },
            },
          ],
        },
        'r1:c2': {
          id: 'consumer',
          rowId: 'r1',
          colId: 'c2',
          actions: [
            {
              id: 'a2',
              order: 0,
              type: 'table_rule',
              enabled: true,
              inputs: ['derived'],
              tableRuleConfig: { rules: [] },
            },
          ],
        },
      },
    });
    const { diagnostics } = compileMatrix(matrix);
    expect(diagnostics.some((d) => d.code === 'UNRESOLVED_INPUT')).toBe(false);
  });

  it('coerces mutation literals at compile time', () => {
    const { plan } = compileMatrix(creditOriginationMatrix);
    const audit = plan!.cells.find((c) => c.cellId === 'cell_bureau_audit')!;
    const action = audit.actions[0]!;
    expect(action.kind).toBe('table_rule');
    if (action.kind === 'table_rule') {
      const mutations = action.rules[0]!.mutations;
      expect(mutations).toContainEqual({ key: 'riskResult', value: 'PASS_SCORECARD' });
      expect(mutations).toContainEqual({ key: 'maxLimit', value: 25000 });
    }
  });

  it('produces a stable plan hash', () => {
    const a = compileMatrix(creditOriginationMatrix).plan!.planHash;
    const b = compileMatrix(JSON.parse(JSON.stringify(creditOriginationMatrix))).plan!.planHash;
    expect(a).toBe(b);
  });
});
