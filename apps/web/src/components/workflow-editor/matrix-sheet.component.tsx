import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { Trash2, AlertTriangle, GripVertical } from "lucide-react";
import {
  DependencyConnectorOverlay,
  ActiveDependency,
} from "@/components/workflow-editor/dependency-connector-overlay.component";
import { WorkflowValidationService } from "@/services/workflow-validation.service";
import { getCellActions } from "@/utils/cell-actions.util";
import { computeCellDependencies } from "@/utils/dependency-tracing.util";
import { useMatrixEditorStore } from "@/stores/matrix-editor.store";

export interface CellExecutionState {
  mutatedPayload?: Record<string, any>;
  matchedRule?: string;
  latencyMs?: number;
}

interface MatrixSheetProps {
  activeStepIndex?: number;
  cellExecutionResults?: Record<string, CellExecutionState>;
}

export function getExcelColumnLetter(index: number): string {
  let letter = "";
  let curr = index;
  while (curr >= 0) {
    letter = String.fromCharCode((curr % 26) + 65) + letter;
    curr = Math.floor(curr / 26) - 1;
  }
  return letter;
}

const DEFAULT_COL_WIDTH = 260;
const MIN_COL_WIDTH = 120;
const DEFAULT_ROW_HEIGHT = 72;
const MIN_ROW_HEIGHT = 40;
const ROW_HEADER_DEFAULT_WIDTH = 260;
const ROW_HEADER_MIN_WIDTH = 160;

const NO_ISSUES: { unresolvedInputs: string[]; clashingOutputs: string[] } = {
  unresolvedInputs: [],
  clashingOutputs: [],
};

const ResizeHandle: React.FC<{
  orientation: "col" | "row";
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}> = ({ orientation, onMouseDown, onDoubleClick }) => {
  const isCol = orientation === "col";
  return (
    <div
      className={`absolute z-20 group/resize hover:bg-emerald-500/40 active:bg-emerald-500/60 transition-colors ${
        isCol
          ? "top-0 right-0 w-1.25 h-full cursor-col-resize"
          : "bottom-0 left-0 w-full h-1.25 cursor-row-resize"
      }`}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      <div
        className={`absolute opacity-0 group-hover/resize:opacity-100 group-hover/resize:bg-emerald-500 group-active/resize:bg-emerald-600 transition-opacity ${
          isCol ? "top-0 right-0 w-0.5 h-full" : "bottom-0 left-0 w-full h-0.5"
        }`}
      />
    </div>
  );
};

export const MatrixSheet: React.FC<MatrixSheetProps> = ({
  activeStepIndex,
  cellExecutionResults,
}) => {
  // Direct Store Subscriptions & Action Dispatchers
  const matrix = useMatrixEditorStore((s) => s.matrix);
  const selectedRowId = useMatrixEditorStore((s) => s.selectedRowId);
  const selectedColId = useMatrixEditorStore((s) => s.selectedColId);
  const copiedCellKey = useMatrixEditorStore((s) => s.copiedCellKey);
  const activeDependency = useMatrixEditorStore((s) => s.activeDependency);
  const showFlows = useMatrixEditorStore((s) => s.showFlows);

  const selectCell = useMatrixEditorStore((s) => s.selectCell);
  const addColumn = useMatrixEditorStore((s) => s.addColumn);
  const addRow = useMatrixEditorStore((s) => s.addRow);
  const deleteRow = useMatrixEditorStore((s) => s.deleteRow);
  const deleteColumn = useMatrixEditorStore((s) => s.deleteColumn);
  const renameColumn = useMatrixEditorStore((s) => s.renameColumn);
  const renameRow = useMatrixEditorStore((s) => s.renameRow);
  const reorderColumns = useMatrixEditorStore((s) => s.reorderColumns);
  const reorderRows = useMatrixEditorStore((s) => s.reorderRows);
  const openModal = useMatrixEditorStore((s) => s.openModal);

  const sortedCols = useMemo(
    () => (matrix ? [...matrix.columns].sort((a, b) => a.order - b.order) : []),
    [matrix?.columns],
  );
  const sortedRows = useMemo(
    () => (matrix ? [...matrix.rows].sort((a, b) => a.order - b.order) : []),
    [matrix?.rows],
  );

  const cellIssues = useMemo(() => {
    const map: Record<
      string,
      { unresolvedInputs: string[]; clashingOutputs: string[] }
    > = {};
    if (!matrix) return map;
    Object.entries(matrix.cells).forEach(([cellKey, cell]) => {
      map[cellKey] = {
        unresolvedInputs: WorkflowValidationService.getUnresolvedCellInputs(
          matrix,
          cell.rowId,
          cell.colId,
        ),
        clashingOutputs: WorkflowValidationService.getClashingCellOutputs(
          matrix,
          cell.rowId,
          cell.colId,
        ),
      };
    });
    return map;
    // Validation only reads structure — metadata edits (name/description)
    // must not trigger an O(cells²) revalidation.
  }, [matrix?.cells, matrix?.columns, matrix?.rows, matrix?.inputs]);

  // Dependency edges for the selected cell, derived on demand instead of
  // persisted in the store so they can never go stale.
  const dependencies = useMemo<ActiveDependency[]>(() => {
    if (!matrix || !showFlows || !selectedRowId || !selectedColId) return [];
    return computeCellDependencies(matrix, selectedRowId, selectedColId);
  }, [matrix, showFlows, selectedRowId, selectedColId]);

  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [rowHeaderWidth, setRowHeaderWidth] = useState(
    ROW_HEADER_DEFAULT_WIDTH,
  );

  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColText, setEditingColText] = useState<string>("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowText, setEditingRowText] = useState<string>("");

  const handleStartRenameCol = useCallback(
    (colId: string, currentLabel: string) => {
      setEditingColId(colId);
      setEditingColText(currentLabel);
    },
    [],
  );

  const handleSaveColName = useCallback(() => {
    if (editingColId && editingColText.trim()) {
      renameColumn(editingColId, editingColText.trim());
    }
    setEditingColId(null);
    setEditingColText("");
  }, [editingColId, editingColText, renameColumn]);

  const handleStartRenameRow = useCallback(
    (rowId: string, currentLabel: string) => {
      setEditingRowId(rowId);
      setEditingRowText(currentLabel);
    },
    [],
  );

  const handleSaveRowName = useCallback(() => {
    if (editingRowId && editingRowText.trim()) {
      renameRow(editingRowId, editingRowText.trim());
    }
    setEditingRowId(null);
    setEditingRowText("");
  }, [editingRowId, editingRowText, renameRow]);

  const [draggingColId, setDraggingColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);

  const handleColDragStart = useCallback(
    (e: React.DragEvent, colId: string) => {
      e.dataTransfer.setData("text/plain", colId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingColId(colId);
    },
    [],
  );

  const handleColDragOver = useCallback(
    (e: React.DragEvent, targetColId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggingColId && draggingColId !== targetColId) {
        setDragOverColId(targetColId);
      }
    },
    [draggingColId],
  );

  const handleColDrop = useCallback(
    (e: React.DragEvent, targetColId: string) => {
      e.preventDefault();
      setDragOverColId(null);
      if (!draggingColId || draggingColId === targetColId) {
        setDraggingColId(null);
        return;
      }

      const currentCols = [...sortedCols];
      const srcIndex = currentCols.findIndex((c) => c.id === draggingColId);
      const targetIndex = currentCols.findIndex((c) => c.id === targetColId);

      if (srcIndex === -1 || targetIndex === -1) {
        setDraggingColId(null);
        return;
      }

      const [movedCol] = currentCols.splice(srcIndex, 1);
      currentCols.splice(targetIndex, 0, movedCol);

      const reordered = currentCols.map((col, idx) => ({
        ...col,
        order: idx,
      }));

      setDraggingColId(null);
      reorderColumns(reordered);
    },
    [draggingColId, sortedCols, reorderColumns],
  );

  const handleColDragEnd = useCallback(() => {
    setDraggingColId(null);
    setDragOverColId(null);
  }, []);

  const handleRowDragStart = useCallback(
    (e: React.DragEvent, rowId: string) => {
      e.dataTransfer.setData("text/plain", rowId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingRowId(rowId);
    },
    [],
  );

  const handleRowDragOver = useCallback(
    (e: React.DragEvent, targetRowId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggingRowId && draggingRowId !== targetRowId) {
        setDragOverRowId(targetRowId);
      }
    },
    [draggingRowId],
  );

  const handleRowDrop = useCallback(
    (e: React.DragEvent, targetRowId: string) => {
      e.preventDefault();
      setDragOverRowId(null);
      if (!draggingRowId || draggingRowId === targetRowId) {
        setDraggingRowId(null);
        return;
      }

      const currentRows = [...sortedRows];
      const srcIndex = currentRows.findIndex((r) => r.id === draggingRowId);
      const targetIndex = currentRows.findIndex((r) => r.id === targetRowId);

      if (srcIndex === -1 || targetIndex === -1) {
        setDraggingRowId(null);
        return;
      }

      const [movedRow] = currentRows.splice(srcIndex, 1);
      currentRows.splice(targetIndex, 0, movedRow);

      const reordered = currentRows.map((row, idx) => ({
        ...row,
        order: idx,
      }));

      setDraggingRowId(null);
      reorderRows(reordered);
    },
    [draggingRowId, sortedRows, reorderRows],
  );

  const handleRowDragEnd = useCallback(() => {
    setDraggingRowId(null);
    setDragOverRowId(null);
  }, []);

  const [pendingScrollColId, setPendingScrollColId] = useState<string | null>(
    null,
  );
  const [pendingScrollRowId, setPendingScrollRowId] = useState<string | null>(
    null,
  );

  const prevColCountRef = useRef(matrix?.columns.length ?? 0);
  const prevRowCountRef = useRef(matrix?.rows.length ?? 0);

  useEffect(() => {
    if (!matrix) return;
    if (matrix.columns.length > prevColCountRef.current) {
      const lastCol = [...matrix.columns]
        .sort((a, b) => a.order - b.order)
        .at(-1);
      if (lastCol) setPendingScrollColId(lastCol.id);
    }
    prevColCountRef.current = matrix.columns.length;
  }, [matrix?.columns]);

  useEffect(() => {
    if (!matrix) return;
    if (matrix.rows.length > prevRowCountRef.current) {
      const lastRow = [...matrix.rows].sort((a, b) => a.order - b.order).at(-1);
      if (lastRow) setPendingScrollRowId(lastRow.id);
    }
    prevRowCountRef.current = matrix.rows.length;
  }, [matrix?.rows]);

  useEffect(() => {
    if (!pendingScrollColId) return;
    const el = scrollRef.current?.querySelector(
      `[data-col-id="${pendingScrollColId}"]`,
    );
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
    setPendingScrollColId(null);
  }, [pendingScrollColId, sortedCols]);

  useEffect(() => {
    if (!pendingScrollRowId) return;
    const el = scrollRef.current?.querySelector(
      `[data-row-id="${pendingScrollRowId}"]`,
    );
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
    setPendingScrollRowId(null);
  }, [pendingScrollRowId, sortedRows]);

  const dragRef = useRef<{
    type: "col" | "row" | "row-header";
    id: string;
    startPos: number;
    startSize: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleColResizeStart = useCallback(
    (e: React.MouseEvent, colId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = colWidths[colId] ?? DEFAULT_COL_WIDTH;
      dragRef.current = {
        type: "col",
        id: colId,
        startPos: e.clientX,
        startSize: startWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [colWidths],
  );

  const handleRowResizeStart = useCallback(
    (e: React.MouseEvent, rowId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startHeight = rowHeights[rowId] ?? DEFAULT_ROW_HEIGHT;
      dragRef.current = {
        type: "row",
        id: rowId,
        startPos: e.clientY,
        startSize: startHeight,
      };
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [rowHeights],
  );

  const handleRowHeaderResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        type: "row-header",
        id: "header",
        startPos: e.clientX,
        startSize: rowHeaderWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [rowHeaderWidth],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.type === "col") {
        const delta = e.clientX - drag.startPos;
        const newWidth = Math.max(MIN_COL_WIDTH, drag.startSize + delta);
        setColWidths((prev) => ({ ...prev, [drag.id]: newWidth }));
      } else if (drag.type === "row") {
        const delta = e.clientY - drag.startPos;
        const newHeight = Math.max(MIN_ROW_HEIGHT, drag.startSize + delta);
        setRowHeights((prev) => ({ ...prev, [drag.id]: newHeight }));
      } else if (drag.type === "row-header") {
        const delta = e.clientX - drag.startPos;
        const newWidth = Math.max(ROW_HEADER_MIN_WIDTH, drag.startSize + delta);
        setRowHeaderWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleColResizeDoubleClick = useCallback((colId: string) => {
    setColWidths((prev) => {
      const next = { ...prev };
      delete next[colId];
      return next;
    });
  }, []);

  const handleRowResizeDoubleClick = useCallback((rowId: string) => {
    setRowHeights((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }, []);

  // After every hook — an undefined matrix mid-session (e.g. workflow switch)
  // must not change the hook call order.
  if (!matrix) return null;

  return (
    <div className="flex-1 w-full h-full relative font-sans text-xs select-none overflow-hidden">
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-auto bg-slate-100"
      >
        <table
          role="grid"
          aria-label="Workflow Matrix Grid"
          tabIndex={0}
          className="text-left border-collapse min-w-max border-t border-l border-slate-200 focus:outline-none"
        >
          <colgroup>
            <col style={{ width: rowHeaderWidth }} />
            {sortedCols.map((col) => (
              <col
                key={col.id}
                style={{ width: colWidths[col.id] ?? DEFAULT_COL_WIDTH }}
              />
            ))}
          </colgroup>

          <thead>
            <tr role="row" className="bg-slate-100 font-mono text-slate-700">
              <th
                data-corner-header="true"
                role="columnheader"
                aria-label="Row and Step column header"
                className="sticky top-0 left-0 z-sticky-corner bg-slate-200 border-r border-b border-slate-200 p-2.5 text-center text-slate-500 font-bold text-[11px]"
                style={{ width: rowHeaderWidth }}
              >
                <div className="flex items-center justify-between text-slate-600 font-semibold px-1">
                  <span className="text-[10px] text-slate-500">ROW</span>
                  <span className="text-[10px] text-slate-400">/</span>
                  <span className="text-[10px] text-slate-500">STEP</span>
                </div>
                <ResizeHandle
                  orientation="col"
                  onMouseDown={handleRowHeaderResizeStart}
                  onDoubleClick={() =>
                    setRowHeaderWidth(ROW_HEADER_DEFAULT_WIDTH)
                  }
                />
              </th>

              {sortedCols.map((col, cIdx) => {
                const isActiveStep = activeStepIndex === cIdx;
                const isColSelected = selectedColId === col.id;
                const isDraggingThisCol = draggingColId === col.id;
                const isDragOverThisCol = dragOverColId === col.id;
                const isEditingThisCol = editingColId === col.id;
                const colLetter = getExcelColumnLetter(cIdx);
                const w = colWidths[col.id] ?? DEFAULT_COL_WIDTH;

                return (
                  <th
                    key={col.id}
                    data-col-id={col.id}
                    role="columnheader"
                    aria-selected={isColSelected}
                    aria-label={`Column ${colLetter}: ${col.label}`}
                    onDragOver={(e) => handleColDragOver(e, col.id)}
                    onDrop={(e) => handleColDrop(e, col.id)}
                    onDragEnd={handleColDragEnd}
                    style={{ width: w, minWidth: MIN_COL_WIDTH }}
                    className={`sticky top-0 z-sticky border-r border-b border-slate-200 p-2.5 transition-all group ${
                      isDraggingThisCol
                        ? "opacity-30 border-2 border-dashed border-slate-400 bg-slate-100"
                        : isDragOverThisCol
                          ? "border-l-4 border-l-slate-700 bg-slate-200"
                          : isActiveStep
                            ? "bg-slate-200 text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-800"
                            : isColSelected
                              ? "bg-slate-200 text-slate-900"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                    }`}
                  >
                    {isColSelected ? (
                      <div className="absolute inset-0 pointer-events-none z-10 border border-slate-400 rounded-xs shadow-[0_0_0_1px_rgba(15,23,42,0.1)]" />
                    ) : null}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                        <div
                          draggable={!isEditingThisCol}
                          onDragStart={(e) => handleColDragStart(e, col.id)}
                          className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-slate-300/70 transition-colors shrink-0"
                          title="Drag handle to reorder column"
                        >
                          <GripVertical className="h-3.5 w-3.5 text-slate-500 hover:text-slate-800 shrink-0" />
                        </div>

                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold shrink-0">
                          {colLetter}
                        </span>

                        {isEditingThisCol ? (
                          <input
                            type="text"
                            value={editingColText}
                            autoFocus
                            onChange={(e) => setEditingColText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveColName();
                              if (e.key === "Escape") setEditingColId(null);
                            }}
                            onBlur={handleSaveColName}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-slate-900 text-xs bg-white border border-slate-400 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-slate-800 flex-1 min-w-22.5 shadow-xs"
                          />
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRenameCol(col.id, col.label);
                            }}
                            className="flex items-center min-w-0 cursor-text hover:bg-slate-200/60 rounded px-1 py-0.5 transition-colors"
                            title="Click to edit step name"
                          >
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {col.label}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteColumn(col.id);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded hover:bg-rose-50 shrink-0"
                        title="Delete Column Step"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <ResizeHandle
                      orientation="col"
                      onMouseDown={(e) => handleColResizeStart(e, col.id)}
                      onDoubleClick={() => handleColResizeDoubleClick(col.id)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody role="rowgroup" className="font-mono text-xs bg-white">
            {sortedRows.map((row, rIdx) => {
              const isRowSelected = selectedRowId === row.id;
              const isDraggingThisRow = draggingRowId === row.id;
              const isDragOverThisRow = dragOverRowId === row.id;
              const isEditingThisRow = editingRowId === row.id;
              const h = rowHeights[row.id] ?? DEFAULT_ROW_HEIGHT;

              return (
                <tr
                  key={row.id}
                  data-row-id={row.id}
                  role="row"
                  className={row.isInterceptor ? "bg-amber-50/30" : ""}
                  style={{ height: h }}
                >
                  <td
                    role="rowheader"
                    aria-selected={isRowSelected}
                    aria-label={`Row ${rIdx + 1}: ${row.label}`}
                    onDragOver={(e) => handleRowDragOver(e, row.id)}
                    onDrop={(e) => handleRowDrop(e, row.id)}
                    onDragEnd={handleRowDragEnd}
                    style={{ width: rowHeaderWidth, height: h }}
                    className={`sticky left-0 z-sticky p-2.5 border-r border-b border-slate-200 group transition-all ${
                      isDraggingThisRow
                        ? "opacity-30 border-2 border-dashed border-slate-400 bg-slate-100"
                        : isDragOverThisRow
                          ? "border-t-4 border-t-slate-700 bg-slate-200"
                          : row.isInterceptor
                            ? "bg-amber-100 text-amber-950"
                            : isRowSelected
                              ? "bg-slate-200 text-slate-950 font-bold"
                              : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {isRowSelected ? (
                      <div className="absolute inset-0 pointer-events-none z-10 border border-slate-400 rounded-xs shadow-[0_0_0_1px_rgba(15,23,42,0.1)]" />
                    ) : null}

                    <div className="flex flex-col justify-center h-full space-y-1">
                      <div className="flex items-center justify-between space-x-1.5 min-w-0">
                        <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                          <div
                            draggable={!isEditingThisRow}
                            onDragStart={(e) => handleRowDragStart(e, row.id)}
                            className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-slate-300/70 transition-colors shrink-0"
                            title="Drag handle to reorder row"
                          >
                            <GripVertical className="h-3.5 w-3.5 text-slate-500 hover:text-slate-800 shrink-0" />
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-bold text-[10px] shrink-0">
                            {rIdx + 1}
                          </span>

                          {isEditingThisRow ? (
                            <input
                              type="text"
                              value={editingRowText}
                              autoFocus
                              onChange={(e) =>
                                setEditingRowText(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveRowName();
                                if (e.key === "Escape") setEditingRowId(null);
                              }}
                              onBlur={handleSaveRowName}
                              onClick={(e) => e.stopPropagation()}
                              className="font-sans font-bold text-xs bg-white border border-slate-400 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-slate-800 w-full min-w-0 shadow-2xs"
                            />
                          ) : (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartRenameRow(row.id, row.label);
                              }}
                              className="flex items-center min-w-0 cursor-text hover:bg-slate-200/60 rounded px-1 py-0.5 transition-colors flex-1"
                              title="Click to edit row name"
                            >
                              <span className="font-sans font-bold text-xs truncate">
                                {row.label}
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => deleteRow(row.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded hover:bg-rose-50 shrink-0"
                          title="Delete Row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center space-x-1.5 pl-6.5 font-mono text-[9px]">
                        <span className="px-1.5 py-0.2 rounded border font-semibold bg-slate-100 text-slate-600 border-slate-200 shrink-0">
                          {row.type === "workflow" ? "SUB-WF" : "STANDARD"}
                        </span>
                      </div>
                    </div>

                    <ResizeHandle
                      orientation="row"
                      onMouseDown={(e) => handleRowResizeStart(e, row.id)}
                      onDoubleClick={() => handleRowResizeDoubleClick(row.id)}
                    />
                  </td>

                  {sortedCols.map((col, cIdx) => {
                    const cellKey = `${row.id}:${col.id}`;
                    const cell = matrix.cells[cellKey];
                    const isActiveStep = activeStepIndex === cIdx;
                    const isSelectedCell =
                      selectedRowId === row.id && selectedColId === col.id;
                    const isCopiedCell = copiedCellKey === cellKey;
                    const execState = cellExecutionResults?.[cellKey];

                    const actionsList = getCellActions(cell);
                    const hasContent = actionsList.length > 0;

                    const allInputs = Array.from(
                      new Set(actionsList.flatMap((a) => a.inputs || [])),
                    );
                    const allOutputs = Array.from(
                      new Set(actionsList.flatMap((a) => a.outputs || [])),
                    );

                    const issues = cellIssues[cellKey] ?? NO_ISSUES;
                    const hasUnresolved = issues.unresolvedInputs.length > 0;
                    const hasClash = issues.clashingOutputs.length > 0;

                    const w = colWidths[col.id] ?? DEFAULT_COL_WIDTH;

                    return (
                      <td
                        key={col.id}
                        data-cell-key={cellKey}
                        role="gridcell"
                        aria-selected={isSelectedCell}
                        onClick={() => selectCell(row.id, col.id)}
                        onDoubleClick={() => {
                          selectCell(row.id, col.id);
                          openModal("cellEditor");
                        }}
                        style={{ width: w, minWidth: MIN_COL_WIDTH, height: h }}
                        className={`relative border-r border-b border-slate-200 p-2 align-top transition-all cursor-pointer group ${
                          isActiveStep
                            ? "bg-slate-50"
                            : isSelectedCell
                              ? "bg-slate-100/80"
                              : isCopiedCell
                                ? "bg-amber-50/50"
                                : "hover:bg-slate-50/60"
                        }`}
                      >
                        {isSelectedCell ? (
                          <div className="absolute inset-0 pointer-events-none z-10 border-2 border-slate-800 shadow-sm" />
                        ) : null}

                        {isCopiedCell ? (
                          <div className="absolute inset-0 pointer-events-none z-10 border-2 border-dashed border-amber-500 animate-pulse" />
                        ) : null}

                        {hasUnresolved || hasClash ? (
                          <div className="flex items-center justify-end space-x-1 mb-1">
                            {hasUnresolved ? (
                              <span
                                className="flex items-center space-x-1 bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                title={`Unresolved inputs: ${issues.unresolvedInputs.join(", ")}`}
                              >
                                <AlertTriangle className="h-3 w-3 text-amber-600" />
                                <span>Input?</span>
                              </span>
                            ) : null}
                            {hasClash ? (
                              <span
                                className="flex items-center space-x-1 bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                title={`Clashing outputs: ${issues.clashingOutputs.join(", ")}`}
                              >
                                <AlertTriangle className="h-3 w-3 text-rose-600" />
                                <span>Clash!</span>
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        {hasContent ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1">
                              <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                {actionsList.length} Action
                                {actionsList.length > 1 ? "s" : ""}
                              </span>
                            </div>

                            {allInputs.length > 0 ? (
                              <div className="flex flex-wrap gap-1 text-[9px]">
                                <span className="text-slate-400">in:</span>
                                {allInputs.map((inp) => (
                                  <span
                                    key={inp}
                                    className="bg-slate-100 text-slate-700 px-1 rounded font-mono"
                                  >
                                    {inp}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            {allOutputs.length > 0 ? (
                              <div className="flex flex-wrap gap-1 text-[9px]">
                                <span className="text-slate-400">out:</span>
                                {allOutputs.map((out) => (
                                  <span
                                    key={out}
                                    className="bg-emerald-100 text-emerald-800 px-1 rounded font-mono font-bold"
                                  >
                                    {out}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            {execState ? (
                              <div className="mt-1 pt-1 border-t border-slate-200 flex items-center justify-between text-[9px] text-emerald-700 font-mono">
                                <span>✓ Ran</span>
                                <span>{execState.latencyMs}ms</span>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-300 text-[10px] italic">
                            Empty
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Add-controls row: sticky to the viewport bottom (and the
                column-add button sticky-left past the row header) so the
                controls stay reachable however far the grid scrolls. */}
            <tr role="row" className="bg-slate-50">
              <td
                role="rowheader"
                aria-label="Add row controls"
                style={{ width: rowHeaderWidth }}
                className="sticky left-0 bottom-0 z-sticky-corner p-2 border-r border-t border-b border-slate-200 bg-slate-100"
              >
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => addRow("standard")}
                    className="flex-1 py-1 px-2 rounded bg-white hover:bg-slate-200 text-slate-700 font-mono text-[10px] font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    + Row
                  </button>
                  <button
                    onClick={() => addRow("workflow")}
                    className="flex-1 py-1 px-2 rounded bg-white hover:bg-slate-200 text-slate-700 font-mono text-[10px] font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    + Sub-WF
                  </button>
                </div>
              </td>
              <td
                colSpan={Math.max(sortedCols.length, 1)}
                className="sticky bottom-0 z-sticky p-2 border-t border-b border-slate-200 bg-slate-50"
              >
                <button
                  onClick={addColumn}
                  className="sticky py-1 px-3 rounded bg-white hover:bg-slate-200 text-slate-700 font-mono text-[10px] font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  style={{ left: rowHeaderWidth + 8 }}
                >
                  + Add Step Column
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {showFlows ? (
        <DependencyConnectorOverlay
          activeDependency={activeDependency}
          dependencies={dependencies}
          containerRef={scrollRef}
        />
      ) : null}
    </div>
  );
};
