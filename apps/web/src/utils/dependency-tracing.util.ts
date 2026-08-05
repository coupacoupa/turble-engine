import { ActiveDependency } from "@/components/workflow-editor/dependency-connector-overlay.component";
import { WorkflowValidationService } from "@/services/workflow-validation.service";
import { MatrixSchema } from "@/types/matrix.types";
import { getCellActions } from "@/utils/cell-actions.util";

/**
 * Finds the closest preceding cell (in matrix execution order) whose actions
 * produce `inputKey`. Returns its "rowId:colId" key, or undefined when the
 * value can only come from the workflow input schema (or nowhere).
 */
export function findProducerCellKey(
  matrix: MatrixSchema,
  rowId: string,
  colId: string,
  inputKey: string,
): string | undefined {
  const colOrderMap = new Map(matrix.columns.map((c) => [c.id, c.order]));
  const rowOrderMap = new Map(matrix.rows.map((r) => [r.id, r.order]));

  const currColOrder = colOrderMap.get(colId);
  const currRowOrder = rowOrderMap.get(rowId);
  if (currColOrder === undefined || currRowOrder === undefined)
    return undefined;

  let producerKey: string | undefined = undefined;
  Object.values(matrix.cells || {}).forEach((cell) => {
    if (cell.rowId === rowId && cell.colId === colId) return;
    const cOrder = colOrderMap.get(cell.colId);
    const rOrder = rowOrderMap.get(cell.rowId);
    if (cOrder === undefined || rOrder === undefined) return;

    const isPreceding =
      cOrder < currColOrder ||
      (cOrder === currColOrder && rOrder < currRowOrder);
    if (!isPreceding) return;

    getCellActions(cell).forEach((act) => {
      if ((act.outputs || []).includes(inputKey)) {
        producerKey = `${cell.rowId}:${cell.colId}`;
      }
    });
  });
  return producerKey;
}

/**
 * Derives every dependency edge (incoming producers, outgoing consumers,
 * output clashes) for the cell at rowId:colId. Pure function of the matrix —
 * call it where the edges are rendered instead of persisting the result.
 */
export function computeCellDependencies(
  matrix: MatrixSchema,
  rowId: string,
  colId: string,
): ActiveDependency[] {
  const row = matrix.rows.find((r) => r.id === rowId);
  const col = matrix.columns.find((c) => c.id === colId);
  if (!row || !col) return [];

  const currentCellKey = `${rowId}:${colId}`;
  const cell = matrix.cells[currentCellKey];
  const deps: ActiveDependency[] = [];

  const colOrderMap = new Map(matrix.columns.map((c) => [c.id, c.order]));
  const rowOrderMap = new Map(matrix.rows.map((r) => [r.id, r.order]));

  const actionsList = getCellActions(cell);
  const consumedInputs = Array.from(
    new Set(actionsList.flatMap((a) => a.inputs || [])),
  );
  const producedOutputs = Array.from(
    new Set(actionsList.flatMap((a) => a.outputs || [])),
  );

  // 1. Trace Incoming Dependencies
  consumedInputs.forEach((inpKey) => {
    const producerKey = findProducerCellKey(matrix, rowId, colId, inpKey);
    if (producerKey) {
      deps.push({
        sourceCellKey: producerKey,
        targetCellKey: currentCellKey,
        variableName: inpKey,
        type: "incoming",
      });
      return;
    }

    const isWfInput = (matrix.inputs || []).some((i) => i.key === inpKey);
    if (isWfInput) {
      deps.push({
        isWorkflowInput: true,
        targetCellKey: currentCellKey,
        variableName: inpKey,
        type: "incoming",
      });
    }
  });

  // 2. Trace Outgoing Dependencies & Clashes
  producedOutputs.forEach((outKey) => {
    const clashSources = WorkflowValidationService.getAllOutputClashingSources(
      outKey,
      matrix,
      rowId,
      colId,
    );
    clashSources.forEach((src) => {
      deps.push({
        sourceCellKey: src.cellKey,
        isWorkflowInput: src.isWorkflowInput,
        targetCellKey: currentCellKey,
        variableName: outKey,
        type: "clash",
      });
    });

    Object.values(matrix.cells || {}).forEach((otherCell) => {
      if (otherCell.rowId === rowId && otherCell.colId === colId) return;
      const cOrder = colOrderMap.get(otherCell.colId);
      const rOrder = rowOrderMap.get(otherCell.rowId);

      if (cOrder === undefined || rOrder === undefined) return;
      const isSucceeding =
        cOrder > col.order || (cOrder === col.order && rOrder > row.order);
      if (!isSucceeding) return;

      const otherActions = getCellActions(otherCell);
      const alsoProducesOutput = otherActions.some((act) =>
        (act.outputs || []).includes(outKey),
      );
      if (alsoProducesOutput) {
        deps.push({
          sourceCellKey: currentCellKey,
          targetCellKey: `${otherCell.rowId}:${otherCell.colId}`,
          variableName: outKey,
          type: "clash",
        });
      }

      otherActions.forEach((act) => {
        if ((act.inputs || []).includes(outKey)) {
          deps.push({
            sourceCellKey: currentCellKey,
            targetCellKey: `${otherCell.rowId}:${otherCell.colId}`,
            variableName: outKey,
            type: "outgoing",
          });
        }
      });
    });
  });

  return deps;
}
