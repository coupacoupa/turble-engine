import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Shield, Layers, PlusCircle, Trash2, Cpu, AlertTriangle, GripVertical } from 'lucide-react';
import { MatrixSchema, DomainRowSchema, StepColumnSchema, RowType, CellSchema } from '@/types/matrix.types';
import { DependencyConnectorOverlay, ActiveDependency } from '@/components/workflow-editor/dependency-connector-overlay.component';
import { WorkflowValidationService } from '@/services/workflow-validation.service';

export interface CellExecutionState {
  mutatedPayload?: Record<string, any>;
  matchedRule?: string;
  latencyMs?: number;
}

interface MatrixSheetProps {
  matrix: MatrixSchema;
  activeStepIndex?: number;
  selectedRowId?: string;
  selectedColId?: string;
  copiedCellKey?: string | null;
  activeDependency?: ActiveDependency | null;
  dependencies?: ActiveDependency[];
  cellExecutionResults?: Record<string, CellExecutionState>;
  showFlows?: boolean;
  onSelectCell: (row: DomainRowSchema, col: StepColumnSchema, cell?: CellSchema) => void;
  onDoubleClickCell?: (row: DomainRowSchema, col: StepColumnSchema, cell?: CellSchema) => void;
  onAddColumn: () => void;
  onAddRow: (type: RowType) => void;
  onToggleInterceptor: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onDeleteColumn: (colId: string) => void;
  onReorderColumns?: (cols: StepColumnSchema[]) => void;
  onReorderRows?: (rows: DomainRowSchema[]) => void;
  onRenameColumn?: (colId: string, newLabel: string) => void;
  onRenameRow?: (rowId: string, newLabel: string) => void;
}

// Utility to convert column index to Excel column letters (0 -> A, 1 -> B, 25 -> Z, 26 -> AA)
export function getExcelColumnLetter(index: number): string {
  let letter = '';
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

export const MatrixSheet: React.FC<MatrixSheetProps> = ({
  matrix,
  activeStepIndex,
  selectedRowId,
  selectedColId,
  copiedCellKey,
  activeDependency,
  dependencies = [],
  cellExecutionResults,
  showFlows = true,
  onSelectCell,
  onDoubleClickCell,
  onAddColumn,
  onAddRow,
  onToggleInterceptor,
  onDeleteRow,
  onDeleteColumn,
  onReorderColumns,
  onReorderRows,
  onRenameColumn,
  onRenameRow,
}) => {
  const sortedCols = [...matrix.columns].sort((a, b) => a.order - b.order);
  const sortedRows = [...matrix.rows].sort((a, b) => a.order - b.order);

  // Column widths keyed by col.id
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  // Row heights keyed by row.id
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  // Row header column width
  const [rowHeaderWidth, setRowHeaderWidth] = useState(ROW_HEADER_DEFAULT_WIDTH);

  // Inline Renaming State for Columns & Rows
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColText, setEditingColText] = useState<string>('');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowText, setEditingRowText] = useState<string>('');

  const handleStartRenameCol = useCallback((colId: string, currentLabel: string) => {
    setEditingColId(colId);
    setEditingColText(currentLabel);
  }, []);

  const handleSaveColName = useCallback(() => {
    if (editingColId && editingColText.trim()) {
      onRenameColumn?.(editingColId, editingColText.trim());
    }
    setEditingColId(null);
    setEditingColText('');
  }, [editingColId, editingColText, onRenameColumn]);

  const handleStartRenameRow = useCallback((rowId: string, currentLabel: string) => {
    setEditingRowId(rowId);
    setEditingRowText(currentLabel);
  }, []);

  const handleSaveRowName = useCallback(() => {
    if (editingRowId && editingRowText.trim()) {
      onRenameRow?.(editingRowId, editingRowText.trim());
    }
    setEditingRowId(null);
    setEditingRowText('');
  }, [editingRowId, editingRowText, onRenameRow]);

  // Drag-and-Drop Reordering state for columns & rows
  const [draggingColId, setDraggingColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);

  // Column Drag Handlers
  const handleColDragStart = useCallback((e: React.DragEvent, colId: string) => {
    e.dataTransfer.setData('text/plain', colId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingColId(colId);
  }, []);

  const handleColDragOver = useCallback(
    (e: React.DragEvent, targetColId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggingColId && draggingColId !== targetColId) {
        setDragOverColId(targetColId);
      }
    },
    [draggingColId]
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
      onReorderColumns?.(reordered);
    },
    [draggingColId, sortedCols, onReorderColumns]
  );

  const handleColDragEnd = useCallback(() => {
    setDraggingColId(null);
    setDragOverColId(null);
  }, []);

  // Row Drag Handlers
  const handleRowDragStart = useCallback((e: React.DragEvent, rowId: string) => {
    e.dataTransfer.setData('text/plain', rowId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingRowId(rowId);
  }, []);

  const handleRowDragOver = useCallback(
    (e: React.DragEvent, targetRowId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggingRowId && draggingRowId !== targetRowId) {
        setDragOverRowId(targetRowId);
      }
    },
    [draggingRowId]
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
      onReorderRows?.(reordered);
    },
    [draggingRowId, sortedRows, onReorderRows]
  );

  const handleRowDragEnd = useCallback(() => {
    setDraggingRowId(null);
    setDragOverRowId(null);
  }, []);

  // Track the last-added col/row id to scroll into view
  const [pendingScrollColId, setPendingScrollColId] = useState<string | null>(null);
  const [pendingScrollRowId, setPendingScrollRowId] = useState<string | null>(null);

  // Track previous counts to detect adds
  const prevColCountRef = useRef(matrix.columns.length);
  const prevRowCountRef = useRef(matrix.rows.length);

  // Detect when a new column was added and flag it for scroll
  useEffect(() => {
    if (matrix.columns.length > prevColCountRef.current) {
      const lastCol = [...matrix.columns].sort((a, b) => a.order - b.order).at(-1);
      if (lastCol) setPendingScrollColId(lastCol.id);
    }
    prevColCountRef.current = matrix.columns.length;
  }, [matrix.columns]);

  // Detect when a new row was added and flag it for scroll
  useEffect(() => {
    if (matrix.rows.length > prevRowCountRef.current) {
      const lastRow = [...matrix.rows].sort((a, b) => a.order - b.order).at(-1);
      if (lastRow) setPendingScrollRowId(lastRow.id);
    }
    prevRowCountRef.current = matrix.rows.length;
  }, [matrix.rows]);

  // Scroll to the newly added column header
  useEffect(() => {
    if (!pendingScrollColId) return;
    const el = scrollRef.current?.querySelector(`[data-col-id="${pendingScrollColId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    setPendingScrollColId(null);
  }, [pendingScrollColId, sortedCols]);

  // Scroll to the newly added row header
  useEffect(() => {
    if (!pendingScrollRowId) return;
    const el = scrollRef.current?.querySelector(`[data-row-id="${pendingScrollRowId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
    setPendingScrollRowId(null);
  }, [pendingScrollRowId, sortedRows]);

  // Drag state refs (avoid re-renders during drag)
  const dragRef = useRef<{
    type: 'col' | 'row' | 'row-header';
    id: string;
    startPos: number;
    startSize: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Column resize drag handlers
  const handleColResizeStart = useCallback(
    (e: React.MouseEvent, colId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = colWidths[colId] ?? DEFAULT_COL_WIDTH;
      dragRef.current = { type: 'col', id: colId, startPos: e.clientX, startSize: startWidth };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [colWidths],
  );

  // Row resize drag handlers
  const handleRowResizeStart = useCallback(
    (e: React.MouseEvent, rowId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const startHeight = rowHeights[rowId] ?? DEFAULT_ROW_HEIGHT;
      dragRef.current = { type: 'row', id: rowId, startPos: e.clientY, startSize: startHeight };
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [rowHeights],
  );

  // Row header column resize drag handler
  const handleRowHeaderResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { type: 'row-header', id: 'header', startPos: e.clientX, startSize: rowHeaderWidth };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [rowHeaderWidth],
  );

  // Shared mouse move / mouse up on document
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.type === 'col') {
        const delta = e.clientX - drag.startPos;
        const newWidth = Math.max(MIN_COL_WIDTH, drag.startSize + delta);
        setColWidths((prev) => ({ ...prev, [drag.id]: newWidth }));
      } else if (drag.type === 'row') {
        const delta = e.clientY - drag.startPos;
        const newHeight = Math.max(MIN_ROW_HEIGHT, drag.startSize + delta);
        setRowHeights((prev) => ({ ...prev, [drag.id]: newHeight }));
      } else if (drag.type === 'row-header') {
        const delta = e.clientX - drag.startPos;
        const newWidth = Math.max(ROW_HEADER_MIN_WIDTH, drag.startSize + delta);
        setRowHeaderWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Double-click column border to auto-fit to default
  const handleColResizeDoubleClick = useCallback((colId: string) => {
    setColWidths((prev) => {
      const next = { ...prev };
      delete next[colId];
      return next;
    });
  }, []);

  // Double-click row border to auto-fit to default
  const handleRowResizeDoubleClick = useCallback((rowId: string) => {
    setRowHeights((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }, []);

  return (
    <div className="flex-1 w-full h-full relative font-sans text-xs select-none overflow-hidden">
      {/* Scrollable table area — padded right & bottom to make space for the sticky overlays */}
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-auto bg-slate-100"
      >
        {showFlows && (
          <DependencyConnectorOverlay activeDependency={activeDependency} dependencies={dependencies} containerRef={scrollRef} />
        )}

        <table
          role="grid"
          aria-label="Workflow Matrix Grid"
          tabIndex={0}
          className="text-left border-collapse min-w-max border-t border-l border-slate-200 focus:outline-none"
        >
          {/* Column sizing hints */}
          <colgroup>
            <col style={{ width: rowHeaderWidth }} />
            {sortedCols.map((col) => (
              <col key={col.id} style={{ width: colWidths[col.id] ?? DEFAULT_COL_WIDTH }} />
            ))}
          </colgroup>

          {/* Step Column Headers (Excel Column Row: A, B, C...) */}
          <thead>
            <tr role="row" className="bg-slate-100 font-mono text-slate-700">
              {/* Frozen Top-Left Corner Cell (0,0) */}
              <th
                data-corner-header="true"
                role="columnheader"
                aria-label="Row and Step column header"
                className="sticky top-0 left-0 z-30 bg-slate-200 border-r border-b border-slate-200 p-2.5 text-center text-slate-500 font-bold text-[11px] relative"
                style={{ width: rowHeaderWidth }}
              >
                <div className="flex items-center justify-between text-slate-600 font-semibold px-1">
                  <span className="text-[10px] text-slate-500">ROW</span>
                  <span className="text-[10px] text-slate-400">/</span>
                  <span className="text-[10px] text-slate-500">STEP</span>
                </div>
                {/* Row header column resize handle */}
                <div
                  className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize z-40 group/resize hover:bg-emerald-500/40 active:bg-emerald-500/60 transition-colors"
                  onMouseDown={handleRowHeaderResizeStart}
                  onDoubleClick={() => setRowHeaderWidth(ROW_HEADER_DEFAULT_WIDTH)}
                >
                  <div className="absolute top-0 right-0 w-[2px] h-full opacity-0 group-hover/resize:opacity-100 group-hover/resize:bg-emerald-500 group-active/resize:bg-emerald-600 transition-opacity" />
                </div>
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
                    className={`sticky top-0 z-20 border-r border-b border-slate-200 p-2.5 transition-all relative group ${
                      isDraggingThisCol
                        ? 'opacity-30 border-2 border-dashed border-slate-400 bg-slate-100'
                        : isDragOverThisCol
                        ? 'border-l-4 border-l-slate-700 bg-slate-200'
                        : isActiveStep
                        ? 'bg-slate-200 text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-slate-800'
                        : isColSelected
                        ? 'bg-slate-200/90 text-slate-900'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-800'
                    }`}
                  >
                    {/* Selected Column Header Node Outline */}
                    {isColSelected && (
                      <div className="absolute inset-0 pointer-events-none z-30 border border-slate-400 rounded-xs shadow-[0_0_0_1px_rgba(15,23,42,0.1)]" />
                    )}

                    {/* Excel Column Header Letter & Step Label */}
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
                              if (e.key === 'Enter') handleSaveColName();
                              if (e.key === 'Escape') setEditingColId(null);
                            }}
                            onBlur={handleSaveColName}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-slate-900 text-xs bg-white border border-emerald-500 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-emerald-500 w-full min-w-0"
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
                            <span className="font-bold text-slate-900 text-xs truncate">{col.label}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteColumn(col.id);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded hover:bg-rose-50 shrink-0"
                        title="Delete Column Step"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Column Resize Handle (right edge) */}
                    <div
                      className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize z-40 group/resize hover:bg-emerald-500/40 active:bg-emerald-500/60 transition-colors"
                      onMouseDown={(e) => handleColResizeStart(e, col.id)}
                      onDoubleClick={() => handleColResizeDoubleClick(col.id)}
                    >
                      <div className="absolute top-0 right-0 w-[2px] h-full opacity-0 group-hover/resize:opacity-100 group-hover/resize:bg-emerald-500 group-active/resize:bg-emerald-600 transition-opacity" />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Matrix Rows & Spreadsheet Cells */}
          <tbody role="rowgroup" className="font-mono text-xs bg-white">
            {sortedRows.map((row, rIdx) => {
              const isRowSelected = selectedRowId === row.id;
              const isDraggingThisRow = draggingRowId === row.id;
              const isDragOverThisRow = dragOverRowId === row.id;
              const isEditingThisRow = editingRowId === row.id;
              const h = rowHeights[row.id] ?? DEFAULT_ROW_HEIGHT;

              return (
                <tr key={row.id} data-row-id={row.id} role="row" className={row.isInterceptor ? 'bg-amber-50/30' : ''} style={{ height: h }}>
                  {/* Frozen Row Header Column (1, 2, 3...) */}
                  <td
                    role="rowheader"
                    aria-selected={isRowSelected}
                    aria-label={`Row ${rIdx + 1}: ${row.label}`}
                    onDragOver={(e) => handleRowDragOver(e, row.id)}
                    onDrop={(e) => handleRowDrop(e, row.id)}
                    onDragEnd={handleRowDragEnd}
                    style={{ width: rowHeaderWidth, height: h }}
                    className={`sticky left-0 z-20 p-2.5 border-r border-b border-slate-200 relative group transition-all ${
                      isDraggingThisRow
                        ? 'opacity-30 border-2 border-dashed border-slate-400 bg-slate-100'
                        : isDragOverThisRow
                        ? 'border-t-4 border-t-slate-700 bg-slate-200'
                        : row.isInterceptor
                        ? 'bg-amber-100/80 text-amber-950'
                        : isRowSelected
                        ? 'bg-slate-200/90 text-slate-950 font-bold'
                        : 'bg-slate-50 text-slate-800'
                    }`}
                  >
                    {/* Selected Row Header Node Outline */}
                    {isRowSelected && (
                      <div className="absolute inset-0 pointer-events-none z-30 border border-slate-400 rounded-xs shadow-[0_0_0_1px_rgba(15,23,42,0.1)]" />
                    )}

                    <div className="flex items-center justify-between space-x-2">
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
                        {row.type === 'workflow' ? (
                          <Layers className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        ) : (
                          <Cpu className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        )}

                        {isEditingThisRow ? (
                          <input
                            type="text"
                            value={editingRowText}
                            autoFocus
                            onChange={(e) => setEditingRowText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRowName();
                              if (e.key === 'Escape') setEditingRowId(null);
                            }}
                            onBlur={handleSaveRowName}
                            onClick={(e) => e.stopPropagation()}
                            className="font-sans font-bold text-xs bg-white border border-emerald-500 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-emerald-500 w-full min-w-0"
                          />
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRenameRow(row.id, row.label);
                            }}
                            className="flex items-center min-w-0 cursor-text hover:bg-slate-200/60 rounded px-1 py-0.5 transition-colors"
                            title="Click to edit row name"
                          >
                            <span className="font-sans font-bold text-xs truncate">{row.label}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => onToggleInterceptor(row.id)}
                          className={`p-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                            row.isInterceptor
                              ? 'bg-amber-200 text-amber-950 border-amber-400'
                              : 'text-slate-400 hover:text-slate-700 border-transparent hover:bg-slate-200'
                          }`}
                          title="Toggle Always-Run Global Interceptor"
                        >
                          <Shield className="h-3 w-3" />
                        </button>

                        <button
                          onClick={() => onDeleteRow(row.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded hover:bg-rose-50"
                          title="Delete Row"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 mt-1 font-mono text-[10px]">
                      <span
                        className={`px-1.5 py-0.2 rounded border font-semibold ${
                          row.type === 'workflow'
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {row.type.toUpperCase()}
                      </span>

                      {row.isInterceptor && (
                        <span className="bg-amber-200 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold">
                          INTERCEPTOR
                        </span>
                      )}
                    </div>

                    {/* Row Resize Handle (bottom edge) */}
                    <div
                      className="absolute bottom-0 left-0 w-full h-[5px] cursor-row-resize z-40 group/resize hover:bg-emerald-500/40 active:bg-emerald-500/60 transition-colors"
                      onMouseDown={(e) => handleRowResizeStart(e, row.id)}
                      onDoubleClick={() => handleRowResizeDoubleClick(row.id)}
                    >
                      <div className="absolute bottom-0 left-0 w-full h-[2px] opacity-0 group-hover/resize:opacity-100 group-hover/resize:bg-emerald-500 group-active/resize:bg-emerald-600 transition-opacity" />
                    </div>
                  </td>

                  {/* Spreadsheet Step Cells */}
                  {sortedCols.map((col, cIdx) => {
                    const cellKey = `${row.id}:${col.id}`;
                    const cell = matrix.cells[cellKey];
                    const isActiveStep = activeStepIndex === cIdx;
                    const isSelectedCell = selectedRowId === row.id && selectedColId === col.id;
                    const isCopiedCell = copiedCellKey === cellKey;
                    const execState = cellExecutionResults?.[cellKey];

                    const actionsList = cell?.actions && cell.actions.length > 0
                      ? cell.actions
                      : cell?.action && cell.action !== 'passthrough'
                      ? [{ type: cell.action, inputs: [], outputs: [], tableRuleConfig: cell.tableRuleConfig }]
                      : [];

                    const hasContent = actionsList.length > 0;
                    const actionCount = actionsList.length;

                    // Extract input/output summary labels
                    const allInputs = Array.from(new Set(actionsList.flatMap((a) => a.inputs || [])));
                    const allOutputs = Array.from(new Set(actionsList.flatMap((a) => a.outputs || [])));
                    const ruleCount = actionsList.reduce((acc, a) => acc + (a.tableRuleConfig?.rules?.length || 0), 0);

                    // Check for unresolved inputs and clashing outputs
                    const unresolvedInputs = WorkflowValidationService.getUnresolvedCellInputs(matrix, row.id, col.id);
                    const clashingOutputs = WorkflowValidationService.getClashingCellOutputs(matrix, row.id, col.id);
                    const hasIssues = unresolvedInputs.length > 0 || clashingOutputs.length > 0;

                    return (
                      <td
                        key={col.id}
                        data-cell-key={`${row.id}:${col.id}`}
                        role="gridcell"
                        tabIndex={isSelectedCell ? 0 : -1}
                        aria-selected={isSelectedCell}
                        aria-label={`Cell ${getExcelColumnLetter(cIdx)}${rIdx + 1}: ${row.label}, ${col.label}`}
                        onClick={() => onSelectCell(row, col, cell)}
                        onDoubleClick={() => onDoubleClickCell?.(row, col, cell)}
                        style={{ width: colWidths[col.id] ?? DEFAULT_COL_WIDTH, height: h }}
                        className={`border-r border-b border-slate-200 cursor-pointer transition-all relative group/cell ${
                          isSelectedCell
                            ? hasIssues
                              ? 'bg-rose-50/40 z-10'
                              : 'bg-slate-100/60 z-10'
                            : execState?.mutatedPayload && Object.keys(execState.mutatedPayload).length > 0
                            ? 'bg-emerald-50/30 hover:bg-emerald-100/50 border-emerald-200'
                            : hasIssues
                            ? 'bg-rose-50/30 hover:bg-rose-100/50 border-rose-200'
                            : isActiveStep
                            ? 'bg-slate-100/40 hover:bg-slate-100/70'
                            : 'bg-white hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Selected Cell Node Outline Overlay */}
                        {isSelectedCell && (
                          <div
                            className={`absolute inset-0 pointer-events-none z-20 border-2 rounded-xs transition-all ${
                              hasIssues
                                ? 'border-rose-600 shadow-[0_0_0_1px_rgba(225,29,72,0.15)]'
                                : 'border-slate-800 shadow-[0_0_0_1px_rgba(15,23,42,0.15)]'
                            }`}
                          />
                        )}

                        {/* Active Cell Excel Fill Handle Corner Dot */}
                        {isSelectedCell && (
                          <div className={`absolute bottom-[-3px] right-[-3px] w-2 h-2 border border-white z-20 rounded-xs ${hasIssues ? 'bg-rose-600' : 'bg-slate-800'}`} />
                        )}

                        {/* Copied Cell Excel Marquee Pulse Outline */}
                        {isCopiedCell && (
                          <div className="absolute inset-0 border-2 border-dashed border-emerald-500 animate-pulse pointer-events-none z-20 shadow-md shadow-emerald-500/20" />
                        )}

                        {/* Issue Warning Badge Icon (Absolute position so template layout is un-affected) */}
                        {hasIssues && (
                          <div className="absolute top-1.5 right-1.5 z-20 pointer-events-auto">
                            <span
                              title={
                                unresolvedInputs.length > 0
                                  ? `Unresolved inputs: ${unresolvedInputs.join(', ')}`
                                  : `Clashing outputs: ${clashingOutputs.join(', ')}`
                              }
                            >
                              <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                            </span>
                          </div>
                        )}

                        {hasContent ? (
                          /* ── Configured cell with content summary ── */
                          <div className="p-2 h-full flex flex-col justify-between font-mono text-[11px]">
                            <div className="space-y-0.5 min-w-0">
                              <div className={`text-slate-900 font-bold truncate text-[11px] flex items-center space-x-1 ${hasIssues ? 'pr-4' : ''}`}>
                                {allInputs.length > 0 || allOutputs.length > 0 ? (
                                  <span className="truncate">
                                    {allInputs.map((inp, iIdx) => {
                                      const isInvalid = unresolvedInputs.includes(inp);
                                      return (
                                        <React.Fragment key={inp}>
                                          {iIdx > 0 && ', '}
                                          <span className={isInvalid ? 'text-rose-700 font-bold underline decoration-rose-400' : ''}>
                                            {inp}
                                          </span>
                                        </React.Fragment>
                                      );
                                    })}
                                    {' ➔ '}
                                    {allOutputs.map((out, oIdx) => {
                                      const isClash = clashingOutputs.includes(out);
                                      return (
                                        <React.Fragment key={out}>
                                          {oIdx > 0 && ', '}
                                          <span className={isClash ? 'text-rose-700 font-bold underline decoration-rose-400' : ''}>
                                            {out}
                                          </span>
                                        </React.Fragment>
                                      );
                                    })}
                                  </span>
                                ) : (
                                  <span className="truncate text-slate-600">Decision Table Configured</span>
                                )}
                              </div>

                              {/* Evaluated Execution Mutated State Badge */}
                              {execState?.mutatedPayload && Object.keys(execState.mutatedPayload).length > 0 ? (
                                <div className="mt-1 bg-amber-50 text-amber-950 border border-amber-300 rounded px-1.5 py-0.5 text-[9.5px] font-mono font-bold truncate flex items-center justify-between shadow-2xs">
                                  <span className="truncate">
                                    {Object.entries(execState.mutatedPayload)
                                      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                                      .join(', ')}
                                  </span>
                                  {execState.latencyMs !== undefined && (
                                    <span className="text-[8px] text-amber-700 shrink-0 ml-1 font-semibold">{execState.latencyMs}ms</span>
                                  )}
                                </div>
                              ) : (
                                <div className={`text-[9px] truncate font-mono ${hasIssues ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                                  {hasIssues
                                    ? unresolvedInputs.length > 0
                                      ? `Missing input source: ${unresolvedInputs.join(', ')}`
                                      : `Output conflict: ${clashingOutputs.join(', ')}`
                                    : ruleCount > 0
                                    ? `${ruleCount} rule matches set`
                                    : 'Sub-Workflow Step'}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* ── Empty cell — blank white, hover hint ── */
                          <div className="h-full flex items-center justify-center">
                            <span className="text-slate-300 text-[11px] font-sans opacity-0 group-hover/cell:opacity-100 transition-opacity select-none pointer-events-none">
                              + Add Rule
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
