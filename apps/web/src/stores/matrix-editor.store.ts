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
import { WorkflowValidationService } from "@/services/workflow-validation.service";
import { findProducerCellKey } from "@/utils/dependency-tracing.util";

export type EditorModal = "cellEditor";

export interface MatrixEditorState {
  // Core Domain State
  matrix: MatrixSchema | undefined;
  latestVersion: number;
  saveState: "idle" | "saving" | "saved" | "error";

  // Selection & Copy/Paste State — IDs only; row/col/cell objects are derived
  // from `matrix` via the exported selectors so they can never go stale.
  selectedRowId: string | null;
  selectedColId: string | null;
  copiedCell: CellSchema | null;
  copiedCellKey: string | null;

  // Transient hover highlight for the dependency overlay. The full dependency
  // edge list is derived where it renders (see computeCellDependencies).
  activeDependency: ActiveDependency | null;
  showFlows: boolean;

  // Modals & Panels State. activeModal makes overlapping modals
  // unrepresentable; the inspector is a docked panel that may coexist.
  activeModal: EditorModal | null;
  isInspectorOpen: boolean;

  // Execution Inspector & Hover State. The inspector mirrors the active test
  // case's run here so the sheet can render it: `selectedStepIndex` is the
  // committed selection, `hoveredStepIndex` is a transient preview that
  // reverts to the selection on mouse-leave.
  testInputPayload: Record<string, any>;
  executionSteps: StepEvaluationRecord[];
  selectedStepIndex: number;
  hoveredStepIndex: number | null;
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
  resetEditor: () => void;

  // Selection Actions
  selectCell: (rowId: string | null, colId: string | null) => void;
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
  openModal: (modal: EditorModal) => void;
  closeModal: () => void;
  setIsInspectorOpen: (
    openOrUpdater: boolean | ((prev: boolean) => boolean),
  ) => void;
  setTestInputPayload: (
    payloadOrUpdater:
      | Record<string, any>
      | ((prev: Record<string, any>) => Record<string, any>),
  ) => void;
  setExecutionSteps: (
    steps: StepEvaluationRecord[],
    selectedIndex: number,
  ) => void;
  setHoveredStepIndex: (idx: number | null) => void;
  setHoveredVariableKey: (key?: string) => void;
}

// Derived-selection selectors. Because unchanged rows/cols/cells keep their
// object identity across matrix updates, these stay reference-stable and only
// re-render subscribers when the selected entity itself changes.
export const selectSelectedRow = (
  s: MatrixEditorState,
): DomainRowSchema | undefined =>
  s.selectedRowId
    ? s.matrix?.rows.find((r) => r.id === s.selectedRowId)
    : undefined;

export const selectSelectedCol = (
  s: MatrixEditorState,
): StepColumnSchema | undefined =>
  s.selectedColId
    ? s.matrix?.columns.find((c) => c.id === s.selectedColId)
    : undefined;

export const selectSelectedCell = (
  s: MatrixEditorState,
): CellSchema | undefined =>
  s.selectedRowId && s.selectedColId
    ? s.matrix?.cells[`${s.selectedRowId}:${s.selectedColId}`]
    : undefined;

const getInitialShowFlows = (): boolean => {
  try {
    return localStorage.getItem("turble_show_flows") === "true";
  } catch {
    return false;
  }
};

const initialEditorState = {
  matrix: undefined,
  latestVersion: 0,
  saveState: "idle",
  selectedRowId: null,
  selectedColId: null,
  copiedCell: null,
  copiedCellKey: null,
  activeDependency: null,
  activeModal: null,
  isInspectorOpen: false,
  testInputPayload: {},
  executionSteps: [],
  selectedStepIndex: 0,
  hoveredStepIndex: null,
  hoveredVariableKey: undefined,
} satisfies Partial<MatrixEditorState>;

export const useMatrixEditorStore = create<MatrixEditorState>((set, get) => ({
  ...initialEditorState,
  showFlows: getInitialShowFlows(),

  setMatrix: (matrixOrUpdater) =>
    set((state) => ({
      matrix:
        typeof matrixOrUpdater === "function"
          ? matrixOrUpdater(state.matrix)
          : matrixOrUpdater,
    })),

  setSaveState: (saveState) => set({ saveState }),
  setLatestVersion: (latestVersion) => set({ latestVersion }),

  // Clears everything workflow-specific (keeps the showFlows preference) so a
  // freshly opened workflow never sees the previous one's state.
  resetEditor: () => set(initialEditorState),

  selectCell: (rowId, colId) =>
    set({
      selectedRowId: rowId,
      selectedColId: colId,
      activeDependency: null,
    }),

  deselectAll: () =>
    set({
      selectedRowId: null,
      selectedColId: null,
      copiedCell: null,
      copiedCellKey: null,
      activeDependency: null,
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
      // Prune the deleted row's cells so validation/iteration never sees
      // (and autosave never persists) orphaned entries.
      const cells = Object.fromEntries(
        Object.entries(state.matrix.cells).filter(
          ([, cell]) => cell.rowId !== rowId,
        ),
      );
      return {
        matrix: {
          ...state.matrix,
          rows: state.matrix.rows.filter((r) => r.id !== rowId),
          cells,
        },
        ...(state.selectedRowId === rowId
          ? { selectedRowId: null, selectedColId: null }
          : {}),
      };
    }),

  deleteColumn: (colId) =>
    set((state) => {
      if (!state.matrix) return {};
      const cells = Object.fromEntries(
        Object.entries(state.matrix.cells).filter(
          ([, cell]) => cell.colId !== colId,
        ),
      );
      return {
        matrix: {
          ...state.matrix,
          columns: state.matrix.columns.filter((c) => c.id !== colId),
          cells,
        },
        ...(state.selectedColId === colId
          ? { selectedRowId: null, selectedColId: null }
          : {}),
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

      return { matrix: { ...state.matrix, cells } };
    }),

  selectSubWorkflow: (subWorkflowId, summaryVersion) =>
    set((state) => {
      if (!state.matrix || !state.selectedRowId) return {};
      const updatedRows = state.matrix.rows.map((r) =>
        r.id === state.selectedRowId
          ? { ...r, subWorkflowId, subWorkflowVersion: summaryVersion }
          : r,
      );
      return { matrix: { ...state.matrix, rows: updatedRows } };
    }),

  copyCell: () => {
    const { selectedRowId, selectedColId, matrix } = get();
    if (!selectedRowId || !selectedColId || !matrix) return;
    const cellKey = `${selectedRowId}:${selectedColId}`;
    const cell = matrix.cells[cellKey];
    if (!cell) return;
    set({ copiedCell: cell, copiedCellKey: cellKey });
    try {
      navigator.clipboard.writeText(JSON.stringify(cell, null, 2));
    } catch {}
  },

  cutCell: () => {
    const { selectedRowId, selectedColId, matrix } = get();
    if (!selectedRowId || !selectedColId || !matrix) return;
    const cellKey = `${selectedRowId}:${selectedColId}`;
    const cell = matrix.cells[cellKey];
    if (!cell) return;

    set((state) => {
      if (!state.matrix) return {};
      const nextCells = { ...state.matrix.cells };
      delete nextCells[cellKey];
      return {
        matrix: { ...state.matrix, cells: nextCells },
        copiedCell: cell,
        copiedCellKey: cellKey,
      };
    });
    try {
      navigator.clipboard.writeText(JSON.stringify(cell, null, 2));
    } catch {}
  },

  pasteCell: async () => {
    const { selectedRowId, selectedColId, matrix, copiedCell } = get();
    if (!selectedRowId || !selectedColId || !matrix) return;
    const targetCellKey = `${selectedRowId}:${selectedColId}`;
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
      rowId: selectedRowId,
      colId: selectedColId,
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
      };
    });
  },

  navigateCell: (dir) => {
    const { matrix, selectedRowId, selectedColId, selectCell } = get();
    if (!matrix || !selectedRowId || !selectedColId) return;
    const sortedCols = [...matrix.columns].sort((a, b) => a.order - b.order);
    const sortedRows = [...matrix.rows].sort((a, b) => a.order - b.order);

    const cIdx = sortedCols.findIndex((c) => c.id === selectedColId);
    const rIdx = sortedRows.findIndex((r) => r.id === selectedRowId);

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
    selectCell(nextRow.id, nextCol.id);
  },

  hoverInputKey: (inputKey) => {
    const { selectedRowId, selectedColId, matrix } = get();
    if (!inputKey || !selectedRowId || !selectedColId || !matrix) {
      set({ activeDependency: null });
      return;
    }

    const targetCellKey = `${selectedRowId}:${selectedColId}`;
    const clashSources = WorkflowValidationService.getAllOutputClashingSources(
      inputKey,
      matrix,
      selectedRowId,
      selectedColId,
    );
    if (clashSources.length > 0) {
      const src = clashSources[0];
      set({
        activeDependency: {
          sourceCellKey: src.cellKey,
          isWorkflowInput: src.isWorkflowInput,
          targetCellKey,
          variableName: inputKey,
          type: "clash",
        },
      });
      return;
    }

    const producerKey = findProducerCellKey(
      matrix,
      selectedRowId,
      selectedColId,
      inputKey,
    );
    if (producerKey) {
      set({
        activeDependency: {
          sourceCellKey: producerKey,
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

  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  setIsInspectorOpen: (openOrUpdater) =>
    set((state) => ({
      isInspectorOpen:
        typeof openOrUpdater === "function"
          ? openOrUpdater(state.isInspectorOpen)
          : openOrUpdater,
    })),

  setTestInputPayload: (payloadOrUpdater) =>
    set((state) => ({
      testInputPayload:
        typeof payloadOrUpdater === "function"
          ? payloadOrUpdater(state.testInputPayload)
          : payloadOrUpdater,
    })),

  setExecutionSteps: (steps, selectedIndex) =>
    set({ executionSteps: steps, selectedStepIndex: selectedIndex }),
  setHoveredStepIndex: (idx) => set({ hoveredStepIndex: idx }),
  setHoveredVariableKey: (key) => set({ hoveredVariableKey: key }),
}));
