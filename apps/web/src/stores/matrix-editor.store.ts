import { create } from "zustand";
import {
  MatrixSchema,
  DomainRowSchema,
  StepColumnSchema,
  CellSchema,
  RowType,
  WorkflowInputField,
  StepEvaluationRecord,
} from "@/types/matrix.types";
import { ActiveDependency } from "@/components/workflow-editor/dependency-connector-overlay.component";
import { getCellActions } from "@/utils/cell-actions.util";
import { WorkflowValidationService } from "@/services/workflow-validation.service";

export interface MatrixEditorState {
  // Core Domain State
  matrix: MatrixSchema | undefined;
  latestVersion: number;
  saveState: "idle" | "saving" | "saved" | "error";

  // Selection & Copy/Paste State
  selectedRow: DomainRowSchema | undefined;
  selectedCol: StepColumnSchema | undefined;
  selectedCell: CellSchema | undefined;
  copiedCell: CellSchema | null;
  copiedCellKey: string | null;

  // Dependency Flow State
  activeDependency: ActiveDependency | null;
  activeDependencies: ActiveDependency[];
  showFlows: boolean;

  // Modals & Panels State
  isDrawerOpen: boolean;
  isValidating: boolean;
  isInspectorModalOpen: boolean;

  // Execution Inspector & Hover State
  testInputPayload: Record<string, any>;
  hoveredStepRecord: StepEvaluationRecord | undefined;
  hoveredVariableKey: string | undefined;

  // Actions
  setMatrix: (
    matrixOrUpdater:
      | MatrixSchema
      | undefined
      | ((prev: MatrixSchema | undefined) => MatrixSchema | undefined),
  ) => void;
  setSaveState: (state: "idle" | "saving" | "saved" | "error") => void;
  setLatestVersion: (v: number) => void;

  // Selection Actions
  selectCell: (
    row?: DomainRowSchema,
    col?: StepColumnSchema,
    cell?: CellSchema,
  ) => void;
  deselectAll: () => void;

  // Grid Mutation Actions
  updateName: (name: string) => void;
  updateDescription: (description: string) => void;
  updateInputs: (inputs: WorkflowInputField[]) => void;
  addColumn: () => void;
  addRow: (type: RowType) => void;
  deleteRow: (rowId: string) => void;
  deleteColumn: (colId: string) => void;
  renameColumn: (colId: string, newLabel: string) => void;
  renameRow: (rowId: string, newLabel: string) => void;
  reorderColumns: (cols: StepColumnSchema[]) => void;
  reorderRows: (rows: DomainRowSchema[]) => void;
  toggleInterceptor: (rowId: string) => void;
  saveCell: (updatedCell: CellSchema) => void;
  selectSubWorkflow: (subWorkflowId: string, summaryVersion?: number) => void;

  // Clipboard Actions
  copyCell: () => void;
  cutCell: () => void;
  pasteCell: () => Promise<void>;

  // Navigation & Dependency Actions
  navigateCell: (dir: "up" | "down" | "left" | "right") => void;
  hoverInputKey: (inputKey: string | null) => void;

  // UI Toggles
  toggleFlows: () => void;
  setIsDrawerOpen: (open: boolean) => void;
  setIsValidating: (open: boolean) => void;
  setIsInspectorModalOpen: (
    openOrUpdater: boolean | ((prev: boolean) => boolean),
  ) => void;
  setTestInputPayload: (
    payloadOrUpdater:
      | Record<string, any>
      | ((prev: Record<string, any>) => Record<string, any>),
  ) => void;
  setHoveredStepRecord: (rec?: StepEvaluationRecord) => void;
  setHoveredVariableKey: (key?: string) => void;
}

const getInitialShowFlows = (): boolean => {
  try {
    return localStorage.getItem("turble_show_flows") === "true";
  } catch {
    return false;
  }
};

export const useMatrixEditorStore = create<MatrixEditorState>((set, get) => ({
  matrix: undefined,
  latestVersion: 0,
  saveState: "idle",
  selectedRow: undefined,
  selectedCol: undefined,
  selectedCell: undefined,
  copiedCell: null,
  copiedCellKey: null,
  activeDependency: null,
  activeDependencies: [],
  showFlows: getInitialShowFlows(),
  isDrawerOpen: false,
  isValidating: false,
  isInspectorModalOpen: false,
  testInputPayload: {},
  hoveredStepRecord: undefined,
  hoveredVariableKey: undefined,

  setMatrix: (matrixOrUpdater) =>
    set((state) => ({
      matrix:
        typeof matrixOrUpdater === "function"
          ? matrixOrUpdater(state.matrix)
          : matrixOrUpdater,
    })),

  setSaveState: (saveState) => set({ saveState }),
  setLatestVersion: (latestVersion) => set({ latestVersion }),

  selectCell: (row, col, cell) => {
    const { matrix } = get();
    if (!matrix || !row || !col) {
      set({
        selectedRow: row,
        selectedCol: col,
        selectedCell: cell,
        activeDependency: null,
        activeDependencies: [],
      });
      return;
    }

    const currentCellKey = `${row.id}:${col.id}`;
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
      let producerKey: string | undefined = undefined;
      Object.values(matrix.cells || {}).forEach((otherCell) => {
        if (otherCell.rowId === row.id && otherCell.colId === col.id) return;
        const cOrder = colOrderMap.get(otherCell.colId);
        const rOrder = rowOrderMap.get(otherCell.rowId);

        if (cOrder === undefined || rOrder === undefined) return;
        const isPreceding =
          cOrder < col.order || (cOrder === col.order && rOrder < row.order);
        if (!isPreceding) return;

        const otherActions = getCellActions(otherCell);
        otherActions.forEach((act) => {
          if ((act.outputs || []).includes(inpKey)) {
            producerKey = `${otherCell.rowId}:${otherCell.colId}`;
          }
        });
      });

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
      const clashSources =
        WorkflowValidationService.getAllOutputClashingSources(
          outKey,
          matrix,
          row.id,
          col.id,
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
        if (otherCell.rowId === row.id && otherCell.colId === col.id) return;
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

    set({
      selectedRow: row,
      selectedCol: col,
      selectedCell: cell,
      activeDependency: null,
      activeDependencies: deps,
    });
  },

  deselectAll: () =>
    set({
      selectedRow: undefined,
      selectedCol: undefined,
      selectedCell: undefined,
      copiedCell: null,
      copiedCellKey: null,
      activeDependency: null,
      activeDependencies: [],
    }),

  updateName: (name) =>
    set((state) => ({
      matrix: state.matrix ? { ...state.matrix, name } : state.matrix,
    })),

  updateDescription: (description) =>
    set((state) => ({
      matrix: state.matrix ? { ...state.matrix, description } : state.matrix,
    })),

  updateInputs: (inputs) =>
    set((state) => ({
      matrix: state.matrix ? { ...state.matrix, inputs } : state.matrix,
    })),

  addColumn: () =>
    set((state) => {
      if (!state.matrix) return {};
      const newColOrder = state.matrix.columns.length;
      const newCol: StepColumnSchema = {
        id: `col_${Date.now()}`,
        label: `Step ${newColOrder + 1}`,
        order: newColOrder,
      };
      return {
        matrix: {
          ...state.matrix,
          columns: [...state.matrix.columns, newCol],
        },
      };
    }),

  addRow: (type) =>
    set((state) => {
      if (!state.matrix) return {};
      const newRowOrder = state.matrix.rows.length;
      const newRow: DomainRowSchema = {
        id: `row_${Date.now()}`,
        label:
          type === "standard"
            ? `Row #${newRowOrder + 1}`
            : `Sub-Workflow Row #${newRowOrder + 1}`,
        order: newRowOrder,
        type,
      };
      return {
        matrix: {
          ...state.matrix,
          rows: [...state.matrix.rows, newRow],
        },
      };
    }),

  deleteRow: (rowId) =>
    set((state) => {
      if (!state.matrix) return {};
      return {
        matrix: {
          ...state.matrix,
          rows: state.matrix.rows.filter((r) => r.id !== rowId),
        },
      };
    }),

  deleteColumn: (colId) =>
    set((state) => {
      if (!state.matrix) return {};
      return {
        matrix: {
          ...state.matrix,
          columns: state.matrix.columns.filter((c) => c.id !== colId),
        },
      };
    }),

  renameColumn: (colId, newLabel) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    set((state) => {
      if (!state.matrix) return {};
      return {
        matrix: {
          ...state.matrix,
          columns: state.matrix.columns.map((c) =>
            c.id === colId ? { ...c, label: trimmed } : c,
          ),
        },
      };
    });
  },

  renameRow: (rowId, newLabel) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    set((state) => {
      if (!state.matrix) return {};
      return {
        matrix: {
          ...state.matrix,
          rows: state.matrix.rows.map((r) =>
            r.id === rowId ? { ...r, label: trimmed } : r,
          ),
        },
      };
    });
  },

  reorderColumns: (reorderedCols) =>
    set((state) => ({
      matrix: state.matrix
        ? { ...state.matrix, columns: reorderedCols }
        : state.matrix,
    })),

  reorderRows: (reorderedRows) =>
    set((state) => ({
      matrix: state.matrix
        ? { ...state.matrix, rows: reorderedRows }
        : state.matrix,
    })),

  toggleInterceptor: (rowId) =>
    set((state) => {
      if (!state.matrix) return {};
      return {
        matrix: {
          ...state.matrix,
          rows: state.matrix.rows.map((r) =>
            r.id === rowId ? { ...r, isInterceptor: !r.isInterceptor } : r,
          ),
        },
      };
    }),

  saveCell: (updatedCell) =>
    set((state) => {
      if (!state.matrix) return {};
      const cellKey = `${updatedCell.rowId}:${updatedCell.colId}`;
      const isEmpty =
        (!updatedCell.actions || updatedCell.actions.length === 0) &&
        (!updatedCell.action || updatedCell.action === "passthrough");

      const cells = { ...state.matrix.cells };
      if (isEmpty) {
        delete cells[cellKey];
      } else {
        cells[cellKey] = updatedCell;
      }

      return {
        matrix: { ...state.matrix, cells },
        selectedCell: isEmpty ? undefined : updatedCell,
      };
    }),

  selectSubWorkflow: (subWorkflowId, summaryVersion) =>
    set((state) => {
      if (!state.matrix || !state.selectedRow) return {};
      const updatedRows = state.matrix.rows.map((r) =>
        r.id === state.selectedRow?.id
          ? { ...r, subWorkflowId, subWorkflowVersion: summaryVersion }
          : r,
      );
      return {
        matrix: { ...state.matrix, rows: updatedRows },
        selectedRow: state.selectedRow
          ? {
              ...state.selectedRow,
              subWorkflowId,
              subWorkflowVersion: summaryVersion,
            }
          : state.selectedRow,
      };
    }),

  copyCell: () => {
    const { selectedRow, selectedCol, matrix } = get();
    if (!selectedRow || !selectedCol || !matrix) return;
    const cellKey = `${selectedRow.id}:${selectedCol.id}`;
    const cell = matrix.cells[cellKey];
    if (!cell) return;
    set({ copiedCell: cell, copiedCellKey: cellKey });
    try {
      navigator.clipboard.writeText(JSON.stringify(cell, null, 2));
    } catch {}
  },

  cutCell: () => {
    const { selectedRow, selectedCol, matrix } = get();
    if (!selectedRow || !selectedCol || !matrix) return;
    const cellKey = `${selectedRow.id}:${selectedCol.id}`;
    const cell = matrix.cells[cellKey];
    if (!cell) return;

    set({ copiedCell: cell, copiedCellKey: cellKey });
    try {
      navigator.clipboard.writeText(JSON.stringify(cell, null, 2));
    } catch {}

    set((state) => {
      if (!state.matrix) return {};
      const nextCells = { ...state.matrix.cells };
      delete nextCells[cellKey];
      return {
        matrix: { ...state.matrix, cells: nextCells },
        selectedCell: undefined,
      };
    });
  },

  pasteCell: async () => {
    const { selectedRow, selectedCol, matrix, copiedCell } = get();
    if (!selectedRow || !selectedCol || !matrix) return;
    const targetCellKey = `${selectedRow.id}:${selectedCol.id}`;
    let sourceCellToPaste: CellSchema | null = copiedCell;

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const parsed = JSON.parse(text);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          (parsed.action || parsed.actions)
        ) {
          sourceCellToPaste = parsed;
        }
      }
    } catch {}

    if (!sourceCellToPaste) return;

    const newActions = sourceCellToPaste.actions?.map((act, idx) => ({
      ...act,
      id: `act_${Date.now()}_${idx}`,
    }));

    const pastedCell: CellSchema = {
      ...sourceCellToPaste,
      id: `cell_${Date.now()}`,
      rowId: selectedRow.id,
      colId: selectedCol.id,
      actions: newActions,
    };

    set((state) => {
      if (!state.matrix) return {};
      return {
        matrix: {
          ...state.matrix,
          cells: {
            ...state.matrix.cells,
            [targetCellKey]: pastedCell,
          },
        },
        selectedCell: pastedCell,
      };
    });
  },

  navigateCell: (dir) => {
    const { matrix, selectedRow, selectedCol, selectCell } = get();
    if (!matrix || !selectedRow || !selectedCol) return;
    const sortedCols = [...matrix.columns].sort((a, b) => a.order - b.order);
    const sortedRows = [...matrix.rows].sort((a, b) => a.order - b.order);

    const cIdx = sortedCols.findIndex((c) => c.id === selectedCol.id);
    const rIdx = sortedRows.findIndex((r) => r.id === selectedRow.id);

    if (cIdx === -1 || rIdx === -1) return;

    let newCIdx = cIdx;
    let newRIdx = rIdx;

    if (dir === "left") newCIdx = Math.max(0, cIdx - 1);
    if (dir === "right") newCIdx = Math.min(sortedCols.length - 1, cIdx + 1);
    if (dir === "up") newRIdx = Math.max(0, rIdx - 1);
    if (dir === "down") newRIdx = Math.min(sortedRows.length - 1, rIdx + 1);

    const nextCol = sortedCols[newCIdx];
    const nextRow = sortedRows[newRIdx];

    if (!nextCol || !nextRow) return;

    const nextCellKey = `${nextRow.id}:${nextCol.id}`;
    const nextCell = matrix.cells[nextCellKey];
    selectCell(nextRow, nextCol, nextCell);
  },

  hoverInputKey: (inputKey) => {
    const { selectedRow, selectedCol, matrix } = get();
    if (!inputKey || !selectedRow || !selectedCol || !matrix) {
      set({ activeDependency: null });
      return;
    }

    const targetCellKey = `${selectedRow.id}:${selectedCol.id}`;
    const clashSources = WorkflowValidationService.getAllOutputClashingSources(
      inputKey,
      matrix,
      selectedRow.id,
      selectedCol.id,
    );
    if (clashSources.length > 0) {
      const clashDeps: ActiveDependency[] = clashSources.map((src) => ({
        sourceCellKey: src.cellKey,
        isWorkflowInput: src.isWorkflowInput,
        targetCellKey,
        variableName: inputKey,
        type: "clash",
      }));
      set((state) => {
        const nonClashes = state.activeDependencies.filter(
          (d) => d.type !== "clash",
        );
        return {
          activeDependencies: [...nonClashes, ...clashDeps],
          activeDependency: clashDeps[0] || null,
        };
      });
      return;
    }

    let foundProducerKey: string | undefined = undefined;
    const colOrderMap = new Map(matrix.columns.map((c) => [c.id, c.order]));
    const rowOrderMap = new Map(matrix.rows.map((r) => [r.id, r.order]));

    const currColOrder = selectedCol.order;
    const currRowOrder = selectedRow.order;

    Object.values(matrix.cells || {}).forEach((c) => {
      if (c.rowId === selectedRow.id && c.colId === selectedCol.id) return;
      const cOrder = colOrderMap.get(c.colId);
      const rOrder = rowOrderMap.get(c.rowId);

      if (cOrder === undefined || rOrder === undefined) return;
      const isPreceding =
        cOrder < currColOrder ||
        (cOrder === currColOrder && rOrder < currRowOrder);

      if (!isPreceding) return;

      const actions = getCellActions(c);
      actions.forEach((act) => {
        if ((act.outputs || []).includes(inputKey)) {
          foundProducerKey = `${c.rowId}:${c.colId}`;
        }
      });
    });

    if (foundProducerKey) {
      set({
        activeDependency: {
          sourceCellKey: foundProducerKey,
          targetCellKey,
          variableName: inputKey,
          type: "incoming",
        },
      });
      return;
    }

    const isWfInput = (matrix.inputs || []).some((i) => i.key === inputKey);
    if (isWfInput) {
      set({
        activeDependency: {
          isWorkflowInput: true,
          targetCellKey,
          variableName: inputKey,
          type: "incoming",
        },
      });
      return;
    }

    set({ activeDependency: null });
  },

  toggleFlows: () =>
    set((state) => {
      const next = !state.showFlows;
      try {
        localStorage.setItem("turble_show_flows", String(next));
      } catch {}
      return { showFlows: next };
    }),

  setIsDrawerOpen: (open) => set({ isDrawerOpen: open }),
  setIsValidating: (open) => set({ isValidating: open }),
  setIsInspectorModalOpen: (openOrUpdater) =>
    set((state) => ({
      isInspectorModalOpen:
        typeof openOrUpdater === "function"
          ? openOrUpdater(state.isInspectorModalOpen)
          : openOrUpdater,
    })),

  setTestInputPayload: (payloadOrUpdater) =>
    set((state) => ({
      testInputPayload:
        typeof payloadOrUpdater === "function"
          ? payloadOrUpdater(state.testInputPayload)
          : payloadOrUpdater,
    })),

  setHoveredStepRecord: (rec) => set({ hoveredStepRecord: rec }),
  setHoveredVariableKey: (key) => set({ hoveredVariableKey: key }),
}));
