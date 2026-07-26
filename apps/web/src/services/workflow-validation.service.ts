import { MatrixSchema } from '@/types/matrix.types';

export class WorkflowValidationService {
  /**
   * Checks if an input parameter key is resolved in the matrix context for a target cell.
   * A key is resolved if:
   * 1. It is defined in global matrix.inputs
   * 2. OR it is produced as an output by a preceding cell in execution order
   * 3. OR it is produced as an output by a preceding action in the same cell
   */
  static isInputResolved(
    inputKey: string,
    matrix: MatrixSchema,
    targetRowId: string,
    targetColId: string,
    actionIndex: number = Infinity
  ): boolean {
    if (!inputKey || !matrix) return false;

    // 1. Check global workflow inputs
    if ((matrix.inputs || []).some((i) => i.key === inputKey)) {
      return true;
    }

    const colOrderMap = new Map(matrix.columns.map((c) => [c.id, c.order]));
    const rowOrderMap = new Map(matrix.rows.map((r) => [r.id, r.order]));

    const targetCol = matrix.columns.find((c) => c.id === targetColId);
    const targetRow = matrix.rows.find((r) => r.id === targetRowId);

    if (!targetCol || !targetRow) return false;

    const currColOrder = targetCol.order;
    const currRowOrder = targetRow.order;

    // 2. Check preceding actions in the same cell
    const currentCell = matrix.cells[`${targetRowId}:${targetColId}`];
    if (currentCell) {
      const actions = currentCell.actions && currentCell.actions.length > 0
        ? currentCell.actions
        : currentCell.action && currentCell.action !== 'passthrough'
        ? [{ type: currentCell.action, outputs: [] }]
        : [];

      const limit = Number.isFinite(actionIndex) ? Math.min(actionIndex, actions.length) : 0;
      for (let i = 0; i < limit; i++) {
        if ((actions[i]?.outputs || []).includes(inputKey)) {
          return true;
        }
      }
    }

    // 3. Check preceding cells in execution order
    let resolved = false;
    Object.values(matrix.cells || {}).forEach((otherCell) => {
      if (otherCell.rowId === targetRowId && otherCell.colId === targetColId) return;

      const cOrder = colOrderMap.get(otherCell.colId);
      const rOrder = rowOrderMap.get(otherCell.rowId);

      if (cOrder === undefined || rOrder === undefined) return;
      const isPreceding = cOrder < currColOrder || (cOrder === currColOrder && rOrder < currRowOrder);
      if (!isPreceding) return;

      const cellActions = otherCell.actions && otherCell.actions.length > 0
        ? otherCell.actions
        : otherCell.action && otherCell.action !== 'passthrough'
        ? [{ type: otherCell.action, outputs: [] }]
        : [];

      cellActions.forEach((act) => {
        if ((act.outputs || []).includes(inputKey)) {
          resolved = true;
        }
      });
    });

    return resolved;
  }

  /**
   * Returns a list of unresolved input keys for a cell.
   */
  static getUnresolvedCellInputs(
    matrix: MatrixSchema,
    rowId: string,
    colId: string
  ): string[] {
    const cell = matrix.cells[`${rowId}:${colId}`];
    if (!cell) return [];

    const actions = cell.actions && cell.actions.length > 0
      ? cell.actions
      : cell.action && cell.action !== 'passthrough'
      ? [{ type: cell.action, inputs: [], outputs: [] }]
      : [];

    const allInputs = Array.from(new Set(actions.flatMap((a) => a.inputs || [])));
    return allInputs.filter((inpKey) => !this.isInputResolved(inpKey, matrix, rowId, colId));
  }

  /**
   * Returns all sources (global workflow inputs or preceding cells) that clash with outputKey for a target cell.
   */
  static getAllOutputClashingSources(
    outputKey: string,
    matrix: MatrixSchema,
    targetRowId: string,
    targetColId: string
  ): Array<{ isWorkflowInput?: boolean; cellKey?: string }> {
    if (!outputKey || !matrix) return [];

    const targetCell = matrix.cells[`${targetRowId}:${targetColId}`];
    if (!targetCell) return [];

    const targetActions = targetCell.actions && targetCell.actions.length > 0
      ? targetCell.actions
      : targetCell.action && targetCell.action !== 'passthrough'
      ? [{ type: targetCell.action, outputs: [] }]
      : [];

    const producesOutput = targetActions.some((a) => (a.outputs || []).includes(outputKey));
    if (!producesOutput) return [];

    const sources: Array<{ isWorkflowInput?: boolean; cellKey?: string }> = [];

    // 1. Global workflow inputs
    if ((matrix.inputs || []).some((i) => i.key === outputKey)) {
      sources.push({ isWorkflowInput: true });
    }

    // 2. Preceding cells in execution order
    const colOrderMap = new Map(matrix.columns.map((c) => [c.id, c.order]));
    const rowOrderMap = new Map(matrix.rows.map((r) => [r.id, r.order]));

    const targetCol = matrix.columns.find((c) => c.id === targetColId);
    const targetRow = matrix.rows.find((r) => r.id === targetRowId);

    if (!targetCol || !targetRow) return sources;

    const currColOrder = targetCol.order;
    const currRowOrder = targetRow.order;

    Object.values(matrix.cells || {}).forEach((otherCell) => {
      if (otherCell.rowId === targetRowId && otherCell.colId === targetColId) return;

      const cOrder = colOrderMap.get(otherCell.colId);
      const rOrder = rowOrderMap.get(otherCell.rowId);

      if (cOrder === undefined || rOrder === undefined) return;
      const isPreceding = cOrder < currColOrder || (cOrder === currColOrder && rOrder < currRowOrder);
      if (!isPreceding) return;

      const cellActions = otherCell.actions && otherCell.actions.length > 0
        ? otherCell.actions
        : otherCell.action && otherCell.action !== 'passthrough'
        ? [{ type: otherCell.action, outputs: [] }]
        : [];

      const producesKey = cellActions.some((act) => (act.outputs || []).includes(outputKey));
      if (producesKey) {
        sources.push({ cellKey: `${otherCell.rowId}:${otherCell.colId}` });
      }
    });

    return sources;
  }

  /**
   * Checks if an output parameter key clashes with global inputs or preceding cell outputs.
   */
  static isOutputClashing(
    outputKey: string,
    matrix: MatrixSchema,
    targetRowId: string,
    targetColId: string,
    actionIndex: number = Infinity
  ): { clashing: boolean; reason?: string } {
    const sources = this.getAllOutputClashingSources(outputKey, matrix, targetRowId, targetColId);
    if (sources.length > 0) {
      const srcLabels = sources.map((s) => (s.isWorkflowInput ? 'Workflow Input' : s.cellKey)).join(', ');
      return {
        clashing: true,
        reason: `Clashes with output defined in (${srcLabels})`,
      };
    }
    return { clashing: false };
  }

  /**
   * Returns a list of clashing output keys for a cell.
   */
  static getClashingCellOutputs(
    matrix: MatrixSchema,
    rowId: string,
    colId: string
  ): string[] {
    const cell = matrix.cells[`${rowId}:${colId}`];
    if (!cell) return [];

    const actions = cell.actions && cell.actions.length > 0
      ? cell.actions
      : cell.action && cell.action !== 'passthrough'
      ? [{ type: cell.action, inputs: [], outputs: [] }]
      : [];

    const allOutputs = Array.from(new Set(actions.flatMap((a) => a.outputs || [])));
    return allOutputs.filter((outKey) => this.isOutputClashing(outKey, matrix, rowId, colId).clashing);
  }
}
