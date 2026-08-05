import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  DependencyConnectorOverlay,
  ActiveDependency,
} from "@/components/workflow-editor/dependency-connector-overlay.component";
import { ColumnHeaderCell } from "@/components/workflow-editor/matrix-sheet/column-header-cell.component";
import {
  CellIssues,
  CellExecutionState,
  GridCell,
} from "@/components/workflow-editor/matrix-sheet/grid-cell.component";
import { ResizeHandle } from "@/components/workflow-editor/matrix-sheet/resize-handle.component";
import { RowHeaderCell } from "@/components/workflow-editor/matrix-sheet/row-header-cell.component";
import { WorkflowValidationService } from "@/services/workflow-validation.service";
import {
  computeCellDependencies,
  computeExecutionFlowEdges,
  computeVariableFlowEdges,
} from "@/utils/dependency-tracing.util";
import { getExcelColumnLetter } from "@/utils/excel-column.util";
import { useMatrixEditorStore } from "@/stores/matrix-editor.store";

const DEFAULT_COL_WIDTH = 260;
const MIN_COL_WIDTH = 120;
const DEFAULT_ROW_HEIGHT = 72;
const MIN_ROW_HEIGHT = 40;
const ROW_HEADER_DEFAULT_WIDTH = 260;
const ROW_HEADER_MIN_WIDTH = 160;

const NO_ISSUES: CellIssues = {
  unresolvedInputs: [],
  clashingOutputs: [],
};

export const MatrixSheet: React.FC = () => {
  const matrix = useMatrixEditorStore((s) => s.matrix);
  const selectedRowId = useMatrixEditorStore((s) => s.selectedRowId);
  const selectedColId = useMatrixEditorStore((s) => s.selectedColId);
  const copiedCellKey = useMatrixEditorStore((s) => s.copiedCellKey);
  const activeDependency = useMatrixEditorStore((s) => s.activeDependency);
  const showFlows = useMatrixEditorStore((s) => s.showFlows);
  const executionSteps = useMatrixEditorStore((s) => s.executionSteps);
  const selectedStepIndex = useMatrixEditorStore((s) => s.selectedStepIndex);
  const hoveredStepIndex = useMatrixEditorStore((s) => s.hoveredStepIndex);
  const hoveredVariableKey = useMatrixEditorStore((s) => s.hoveredVariableKey);
  const isInspectorOpen = useMatrixEditorStore((s) => s.isInspectorOpen);

  const addColumn = useMatrixEditorStore((s) => s.addColumn);
  const addRow = useMatrixEditorStore((s) => s.addRow);

  const sortedCols = useMemo(
    () => (matrix ? [...matrix.columns].sort((a, b) => a.order - b.order) : []),
    [matrix?.columns],
  );
  const sortedRows = useMemo(
    () => (matrix ? [...matrix.rows].sort((a, b) => a.order - b.order) : []),
    [matrix?.rows],
  );

  // Execution inspector → grid highlight, derived from the store so the
  // inspector and the sheet stay wired without prop threading. Hovering a step
  // previews it; on mouse-leave the display reverts to the selected step.
  const displayStepIndex = hoveredStepIndex ?? selectedStepIndex;
  const displayStepRecord = executionSteps[displayStepIndex];

  const activeStepIndex = useMemo(
    () =>
      displayStepRecord
        ? sortedCols.findIndex((c) => c.id === displayStepRecord.colId)
        : -1,
    [displayStepRecord, sortedCols],
  );

  // Cumulative "flow till then": every cell executed in steps 0..display gets
  // its result, so the sheet shows the run's whole path up to that step.
  const cellExecutionResults = useMemo<
    Record<string, CellExecutionState> | undefined
  >(() => {
    if (!displayStepRecord) return undefined;
    const map: Record<string, CellExecutionState> = {};
    for (let i = 0; i <= displayStepIndex && i < executionSteps.length; i++) {
      executionSteps[i]!.cellResults.forEach((res) => {
        map[`${res.rowId}:${res.colId}`] = {
          mutatedPayload: res.mutatedPayload,
          latencyMs: res.latencyMs,
        };
      });
    }
    return map;
  }, [executionSteps, displayStepIndex, displayStepRecord]);

  const cellIssues = useMemo(() => {
    const map: Record<string, CellIssues> = {};
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

  // Flow edges for the connector overlay, derived on demand instead of
  // persisted in the store so they can never go stale. Precedence mirrors how
  // explicit the interaction is:
  //   1. hovering a variable  → that variable's producer→consumer edges
  //   2. hovering a step      → the run's data flow up to that step
  //   3. inspector open + run → the run's data flow up to the selected step
  //   4. showFlows + cell     → the selected cell's authoring dependencies
  const dependencies = useMemo<ActiveDependency[]>(() => {
    if (!matrix) return [];

    const runPayload = executionSteps[displayStepIndex]?.finalPayload;
    if (hoveredVariableKey) {
      return computeVariableFlowEdges(matrix, hoveredVariableKey, runPayload);
    }
    if (hoveredStepIndex !== null && executionSteps.length > 0) {
      return computeExecutionFlowEdges(
        matrix,
        executionSteps,
        hoveredStepIndex,
      );
    }
    if (isInspectorOpen && executionSteps.length > 0) {
      return computeExecutionFlowEdges(
        matrix,
        executionSteps,
        selectedStepIndex,
      );
    }
    if (showFlows && selectedRowId && selectedColId) {
      return computeCellDependencies(matrix, selectedRowId, selectedColId);
    }
    return [];
  }, [
    matrix,
    hoveredVariableKey,
    hoveredStepIndex,
    isInspectorOpen,
    executionSteps,
    selectedStepIndex,
    displayStepIndex,
    showFlows,
    selectedRowId,
    selectedColId,
  ]);

  // Sizing state. Mirrored into refs so the resize-start handlers stay
  // reference-stable and never break header/cell memoization.
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [rowHeaderWidth, setRowHeaderWidth] = useState(
    ROW_HEADER_DEFAULT_WIDTH,
  );
  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;
  const rowHeightsRef = useRef(rowHeights);
  rowHeightsRef.current = rowHeights;
  const rowHeaderWidthRef = useRef(rowHeaderWidth);
  rowHeaderWidthRef.current = rowHeaderWidth;

  // Drag-reorder state. The dragging ids live in refs (read at event time)
  // with a state mirror for the visual treatment, keeping every drag handler
  // reference-stable.
  const draggingColIdRef = useRef<string | null>(null);
  const draggingRowIdRef = useRef<string | null>(null);
  const [draggingColId, setDraggingColIdState] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [draggingRowId, setDraggingRowIdState] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);

  const setDraggingColId = useCallback((id: string | null) => {
    draggingColIdRef.current = id;
    setDraggingColIdState(id);
  }, []);
  const setDraggingRowId = useCallback((id: string | null) => {
    draggingRowIdRef.current = id;
    setDraggingRowIdState(id);
  }, []);

  const handleColDragStart = useCallback(
    (e: React.DragEvent, colId: string) => {
      e.dataTransfer.setData("text/plain", colId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingColId(colId);
    },
    [setDraggingColId],
  );

  const handleColDragOver = useCallback(
    (e: React.DragEvent, targetColId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const src = draggingColIdRef.current;
      if (src && src !== targetColId) {
        setDragOverColId(targetColId);
      }
    },
    [],
  );

  const handleColDrop = useCallback(
    (e: React.DragEvent, targetColId: string) => {
      e.preventDefault();
      setDragOverColId(null);
      const src = draggingColIdRef.current;
      setDraggingColId(null);
      if (!src || src === targetColId) return;

      // Event-time store read keeps this callback stable.
      const { matrix: current, reorderColumns } =
        useMatrixEditorStore.getState();
      if (!current) return;

      const cols = [...current.columns].sort((a, b) => a.order - b.order);
      const srcIndex = cols.findIndex((c) => c.id === src);
      const targetIndex = cols.findIndex((c) => c.id === targetColId);
      if (srcIndex === -1 || targetIndex === -1) return;

      const [movedCol] = cols.splice(srcIndex, 1);
      cols.splice(targetIndex, 0, movedCol!);
      reorderColumns(cols.map((col, idx) => ({ ...col, order: idx })));
    },
    [setDraggingColId],
  );

  const handleColDragEnd = useCallback(() => {
    setDraggingColId(null);
    setDragOverColId(null);
  }, [setDraggingColId]);

  const handleRowDragStart = useCallback(
    (e: React.DragEvent, rowId: string) => {
      e.dataTransfer.setData("text/plain", rowId);
      e.dataTransfer.effectAllowed = "move";
      setDraggingRowId(rowId);
    },
    [setDraggingRowId],
  );

  const handleRowDragOver = useCallback(
    (e: React.DragEvent, targetRowId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const src = draggingRowIdRef.current;
      if (src && src !== targetRowId) {
        setDragOverRowId(targetRowId);
      }
    },
    [],
  );

  const handleRowDrop = useCallback(
    (e: React.DragEvent, targetRowId: string) => {
      e.preventDefault();
      setDragOverRowId(null);
      const src = draggingRowIdRef.current;
      setDraggingRowId(null);
      if (!src || src === targetRowId) return;

      const { matrix: current, reorderRows } = useMatrixEditorStore.getState();
      if (!current) return;

      const rows = [...current.rows].sort((a, b) => a.order - b.order);
      const srcIndex = rows.findIndex((r) => r.id === src);
      const targetIndex = rows.findIndex((r) => r.id === targetRowId);
      if (srcIndex === -1 || targetIndex === -1) return;

      const [movedRow] = rows.splice(srcIndex, 1);
      rows.splice(targetIndex, 0, movedRow!);
      reorderRows(rows.map((row, idx) => ({ ...row, order: idx })));
    },
    [setDraggingRowId],
  );

  const handleRowDragEnd = useCallback(() => {
    setDraggingRowId(null);
    setDragOverRowId(null);
  }, [setDraggingRowId]);

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
      const startWidth = colWidthsRef.current[colId] ?? DEFAULT_COL_WIDTH;
      dragRef.current = {
        type: "col",
        id: colId,
        startPos: e.clientX,
        startSize: startWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [],
  );

  const handleRowResizeStart = useCallback(
    (e: React.MouseEvent, rowId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startHeight = rowHeightsRef.current[rowId] ?? DEFAULT_ROW_HEIGHT;
      dragRef.current = {
        type: "row",
        id: rowId,
        startPos: e.clientY,
        startSize: startHeight,
      };
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [],
  );

  const handleRowHeaderResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      type: "row-header",
      id: "header",
      startPos: e.clientX,
      startSize: rowHeaderWidthRef.current,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

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

              {sortedCols.map((col, cIdx) => (
                <ColumnHeaderCell
                  key={col.id}
                  col={col}
                  colLetter={getExcelColumnLetter(cIdx)}
                  width={colWidths[col.id] ?? DEFAULT_COL_WIDTH}
                  minWidth={MIN_COL_WIDTH}
                  isActiveStep={activeStepIndex === cIdx}
                  isSelected={selectedColId === col.id}
                  isDragging={draggingColId === col.id}
                  isDragOver={dragOverColId === col.id}
                  onDragStart={handleColDragStart}
                  onDragOver={handleColDragOver}
                  onDrop={handleColDrop}
                  onDragEnd={handleColDragEnd}
                  onResizeStart={handleColResizeStart}
                  onResizeReset={handleColResizeDoubleClick}
                />
              ))}
            </tr>
          </thead>

          <tbody role="rowgroup" className="font-mono text-xs bg-white">
            {sortedRows.map((row, rIdx) => {
              const h = rowHeights[row.id] ?? DEFAULT_ROW_HEIGHT;

              return (
                <tr
                  key={row.id}
                  data-row-id={row.id}
                  role="row"
                  className={row.isInterceptor ? "bg-amber-50/30" : ""}
                  style={{ height: h }}
                >
                  <RowHeaderCell
                    row={row}
                    rowNum={rIdx + 1}
                    width={rowHeaderWidth}
                    height={h}
                    isSelected={selectedRowId === row.id}
                    isDragging={draggingRowId === row.id}
                    isDragOver={dragOverRowId === row.id}
                    onDragStart={handleRowDragStart}
                    onDragOver={handleRowDragOver}
                    onDrop={handleRowDrop}
                    onDragEnd={handleRowDragEnd}
                    onResizeStart={handleRowResizeStart}
                    onResizeReset={handleRowResizeDoubleClick}
                  />

                  {sortedCols.map((col, cIdx) => {
                    const cellKey = `${row.id}:${col.id}`;
                    return (
                      <GridCell
                        key={col.id}
                        cell={matrix.cells[cellKey]}
                        cellKey={cellKey}
                        rowId={row.id}
                        colId={col.id}
                        width={colWidths[col.id] ?? DEFAULT_COL_WIDTH}
                        minWidth={MIN_COL_WIDTH}
                        height={h}
                        isActiveStep={activeStepIndex === cIdx}
                        isSelected={
                          selectedRowId === row.id && selectedColId === col.id
                        }
                        isCopied={copiedCellKey === cellKey}
                        issues={cellIssues[cellKey] ?? NO_ISSUES}
                        execState={cellExecutionResults?.[cellKey]}
                      />
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

      {/* Persistent flow lines are gated on the Flows toggle; the transient
          hover dependency (from the cell editor) renders regardless. */}
      {showFlows || activeDependency ? (
        <DependencyConnectorOverlay
          activeDependency={activeDependency}
          dependencies={dependencies}
          containerRef={scrollRef}
        />
      ) : null}
    </div>
  );
};
