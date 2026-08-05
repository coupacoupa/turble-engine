import { ActiveDependency } from "@/components/workflow-editor/dependency-connector-overlay.component";
import { WorkflowValidationService } from "@/services/workflow-validation.service";
import { MatrixSchema, StepEvaluationRecord } from "@/types/matrix.types";
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
 * Data-flow edges of an executed run, cumulative up to and including
 * `stepIndex`: for every cell executed so far, one incoming edge per consumed
 * input from its producer (or the workflow inputs), carrying the runtime value
 * the cell actually saw. The displayed step additionally gets outgoing edges
 * for the outputs it just produced, pointing at their (future) consumers.
 */
export function computeExecutionFlowEdges(
  matrix: MatrixSchema,
  steps: StepEvaluationRecord[],
  stepIndex: number,
): ActiveDependency[] {
  const edges: ActiveDependency[] = [];
  const seen = new Set<string>();
  const last = Math.min(stepIndex, steps.length - 1);

  const colOrderMap = new Map(matrix.columns.map((c) => [c.id, c.order]));
  const rowOrderMap = new Map(matrix.rows.map((r) => [r.id, r.order]));

  for (let i = 0; i <= last; i++) {
    const step = steps[i]!;
    const isDisplayedStep = i === last;

    for (const res of step.cellResults || []) {
      if (res.status === "skipped") continue;
      const targetCellKey = `${res.rowId}:${res.colId}`;
      const cell = matrix.cells[targetCellKey];
      if (!cell) continue;

      const actionsList = getCellActions(cell);
      const inputs = new Set(actionsList.flatMap((a) => a.inputs || []));
      inputs.forEach((inpKey) => {
        const producerKey = findProducerCellKey(
          matrix,
          res.rowId,
          res.colId,
          inpKey,
        );
        const isWfInput =
          !producerKey && (matrix.inputs || []).some((f) => f.key === inpKey);
        if (!producerKey && !isWfInput) return;

        const id = `${producerKey || "wf"}->${targetCellKey}:${inpKey}`;
        if (seen.has(id)) return;
        seen.add(id);

        edges.push({
          sourceCellKey: producerKey,
          isWorkflowInput: producerKey ? undefined : true,
          targetCellKey,
          variableName: inpKey,
          type: "incoming",
          value: step.initialPayload?.[inpKey],
        });
      });

      // Outgoing edges only for the step currently displayed — earlier steps'
      // outputs already appear as their consumers' incoming edges.
      if (!isDisplayedStep) continue;

      const currColOrder = colOrderMap.get(res.colId);
      const currRowOrder = rowOrderMap.get(res.rowId);
      if (currColOrder === undefined || currRowOrder === undefined) continue;

      const outputs = new Set(actionsList.flatMap((a) => a.outputs || []));
      outputs.forEach((outKey) => {
        const producedValue =
          res.mutatedPayload?.[outKey] ?? step.finalPayload?.[outKey];

        Object.values(matrix.cells || {}).forEach((otherCell) => {
          const cOrder = colOrderMap.get(otherCell.colId);
          const rOrder = rowOrderMap.get(otherCell.rowId);
          if (cOrder === undefined || rOrder === undefined) return;

          const isSucceeding =
            cOrder > currColOrder ||
            (cOrder === currColOrder && rOrder > currRowOrder);
          if (!isSucceeding) return;

          const consumes = getCellActions(otherCell).some((a) =>
            (a.inputs || []).includes(outKey),
          );
          if (!consumes) return;

          const consumerKey = `${otherCell.rowId}:${otherCell.colId}`;
          const id = `${targetCellKey}->${consumerKey}:${outKey}:out`;
          if (seen.has(id)) return;
          seen.add(id);

          edges.push({
            sourceCellKey: targetCellKey,
            targetCellKey: consumerKey,
            variableName: outKey,
            type: "outgoing",
            value: producedValue,
          });
        });
      });
    }
  }
  return edges;
}

/**
 * Producer → consumer edges for a single variable across the matrix: one edge
 * into every cell that consumes it, from its resolved producer (or the
 * workflow inputs). Used for the inspector's variable-hover highlight.
 */
export function computeVariableFlowEdges(
  matrix: MatrixSchema,
  variableKey: string,
  runtimePayload?: Record<string, any>,
): ActiveDependency[] {
  const edges: ActiveDependency[] = [];
  const value = runtimePayload?.[variableKey];

  Object.values(matrix.cells || {}).forEach((cell) => {
    const consumes = getCellActions(cell).some((a) =>
      (a.inputs || []).includes(variableKey),
    );
    if (!consumes) return;

    const targetCellKey = `${cell.rowId}:${cell.colId}`;
    const producerKey = findProducerCellKey(
      matrix,
      cell.rowId,
      cell.colId,
      variableKey,
    );
    const isWfInput =
      !producerKey && (matrix.inputs || []).some((f) => f.key === variableKey);
    if (!producerKey && !isWfInput) return;

    edges.push({
      sourceCellKey: producerKey,
      isWorkflowInput: producerKey ? undefined : true,
      targetCellKey,
      variableName: variableKey,
      type: "incoming",
      value,
    });
  });
  return edges;
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
