import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Shield, Layers, PlusCircle, Trash2, Cpu, AlertTriangle } from 'lucide-react';
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
  activeDependency?: ActiveDependency | null;
  dependencies?: ActiveDependency[];
  cellExecutionResults?: Record<string, CellExecutionState>;
  onSelectCell: (row: DomainRowSchema, col: StepColumnSchema, cell?: CellSchema) => void;
  onDoubleClickCell?: (row: DomainRowSchema, col: StepColumnSchema, cell?: CellSchema) => void;
  onAddColumn: () => void;
  onAddRow: (type: RowType) => void;
  onToggleInterceptor: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onDeleteColumn: (colId: string) => void;
}

// Utility to convert column index to Excel column letters (0 -> A, 1 -> B, 25 -> Z, 26 -> AA)
function getExcelColumnLetter(index: number): string {
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
  activeDependency,
  dependencies = [],
  cellExecutionResults,
  onSelectCell,
  onDoubleClickCell,
  onAddColumn,
  onAddRow,
  onToggleInterceptor,
  onDeleteRow,
  onDeleteColumn,
}) => {
  const sortedCols = [...matrix.columns].sort((a, b) => a.order - b.order);
  const sortedRows = [...matrix.rows].sort((a, b) => a.order - b.order);

  // Column widths keyed by col.id
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  // Row heights keyed by row.id
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  // Row header column width
  const [rowHeaderWidth, setRowHeaderWidth] = useState(ROW_HEADER_DEFAULT_WIDTH);

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
        <DependencyConnectorOverlay activeDependency={activeDependency} dependencies={dependencies} containerRef={scrollRef} />

        <table className="text-left border-collapse min-w-max border-t border-l border-slate-200">
          {/* Column sizing hints */}
          <colgroup>
            <col style={{ width: rowHeaderWidth }} />
            {sortedCols.map((col) => (
              <col key={col.id} style={{ width: colWidths[col.id] ?? DEFAULT_COL_WIDTH }} />
            ))}
          </colgroup>

          {/* Step Column Headers (Excel Column Row: A, B, C...) */}
          <thead>
            <tr className="bg-slate-100 font-mono text-slate-700">
              {/* Frozen Top-Left Corner Cell (0,0) */}
              <th
                data-corner-header="true"
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
                const colLetter = getExcelColumnLetter(cIdx);
                const w = colWidths[col.id] ?? DEFAULT_COL_WIDTH;

                return (
                  <th
                    key={col.id}
                    data-col-id={col.id}
                    style={{ width: w, minWidth: MIN_COL_WIDTH }}
                    className={`sticky top-0 z-20 border-r border-b border-slate-200 p-2.5 transition-colors relative group ${
                      isActiveStep
                        ? 'bg-emerald-100 text-emerald-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-emerald-600'
                        : isColSelected
                        ? 'bg-emerald-50 text-emerald-900'
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-800'
                    }`}
                  >
                    {/* Excel Column Header Letter & Step Label */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold shrink-0">
                          {colLetter}
                        </span>
                        <span className="font-bold text-slate-900 text-xs truncate">{col.label}</span>
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
          <tbody className="font-mono text-xs bg-white">
            {sortedRows.map((row, rIdx) => {
              const isRowSelected = selectedRowId === row.id;
              const h = rowHeights[row.id] ?? DEFAULT_ROW_HEIGHT;

              return (
                <tr key={row.id} data-row-id={row.id} className={row.isInterceptor ? 'bg-amber-50/30' : ''} style={{ height: h }}>
                  {/* Frozen Row Header Column (1, 2, 3...) */}
                  <td
                    style={{ width: rowHeaderWidth, height: h }}
                    className={`sticky left-0 z-20 p-2.5 border-r border-b border-slate-200 relative group ${
                      row.isInterceptor
                        ? 'bg-amber-100/80 text-amber-950'
                        : isRowSelected
                        ? 'bg-emerald-100/70 text-emerald-950'
                        : 'bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between space-x-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-bold text-[10px] shrink-0">
                          {rIdx + 1}
                        </span>
                        {row.type === 'workflow' ? (
                          <Layers className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                        ) : (
                          <Cpu className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        )}
                        <span className="font-sans font-bold text-xs truncate">{row.label}</span>
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
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
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
                        onClick={() => onSelectCell(row, col, cell)}
                        onDoubleClick={() => onDoubleClickCell?.(row, col, cell)}
                        style={{ width: colWidths[col.id] ?? DEFAULT_COL_WIDTH, height: h }}
                        className={`border-r border-b border-slate-200 cursor-pointer transition-all relative group/cell ${
                          isSelectedCell
                            ? hasIssues
                              ? 'ring-2 ring-rose-600 bg-rose-50/70 z-10'
                              : 'ring-2 ring-emerald-600 bg-emerald-50/40 z-10'
                            : execState?.mutatedPayload && Object.keys(execState.mutatedPayload).length > 0
                            ? 'bg-emerald-50/40 hover:bg-emerald-100/60 border-emerald-300'
                            : hasIssues
                            ? 'bg-rose-50/50 hover:bg-rose-100/70 border-rose-200'
                            : isActiveStep
                            ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                            : 'bg-white hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Active Cell Excel Fill Handle Corner Dot */}
                        {isSelectedCell && (
                          <div className={`absolute bottom-[-3px] right-[-3px] w-2 h-2 border border-white z-20 rounded-xs ${hasIssues ? 'bg-rose-600' : 'bg-emerald-600'}`} />
                        )}

                        {hasContent ? (
                          /* ── Configured cell with content summary ── */
                          <div className="p-2 h-full flex flex-col justify-between font-mono text-[11px]">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400 font-bold">
                                {getExcelColumnLetter(cIdx)}
                                {rIdx + 1}
                              </span>
                              {hasIssues ? (
                                <span
                                  title={
                                    unresolvedInputs.length > 0
                                      ? `Unresolved inputs: ${unresolvedInputs.join(', ')}`
                                      : `Clashing outputs: ${clashingOutputs.join(', ')}`
                                  }
                                  className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[9px] flex items-center space-x-1 shadow-2xs"
                                >
                                  <AlertTriangle className="h-2.5 w-2.5 text-rose-600 shrink-0" />
                                  <span>{unresolvedInputs.length > 0 ? `${unresolvedInputs.length} MISSING` : `${clashingOutputs.length} CLASH`}</span>
                                </span>
                              ) : (
                                <span
                                  className={`px-1.5 py-0.2 rounded border font-bold text-[9px] ${
                                    execState?.mutatedPayload && Object.keys(execState.mutatedPayload).length > 0
                                      ? 'bg-amber-100 text-amber-950 border-amber-400'
                                      : actionCount > 1
                                      ? 'bg-purple-50 text-purple-700 border-purple-300'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  }`}
                                >
                                  {execState?.mutatedPayload && Object.keys(execState.mutatedPayload).length > 0
                                    ? 'MUTATED'
                                    : actionCount > 1
                                    ? `${actionCount} ACTIONS`
                                    : `RULES (${ruleCount})`}
                                </span>
                              )}
                            </div>

                            <div className="space-y-0.5 min-w-0">
                              <div className="text-slate-900 font-bold truncate text-[11px] flex items-center space-x-1">
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
