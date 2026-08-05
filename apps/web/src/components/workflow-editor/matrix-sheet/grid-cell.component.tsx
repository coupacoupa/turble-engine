import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { CellSchema } from "@/types/matrix.types";
import { getCellActions } from "@/utils/cell-actions.util";
import { useMatrixEditorStore } from "@/stores/matrix-editor.store";

export interface CellExecutionState {
  mutatedPayload?: Record<string, any>;
  matchedRule?: string;
  latencyMs?: number;
}

export interface CellIssues {
  unresolvedInputs: string[];
  clashingOutputs: string[];
}

interface GridCellProps {
  cell: CellSchema | undefined;
  cellKey: string;
  rowId: string;
  colId: string;
  width: number;
  minWidth: number;
  height: number;
  isActiveStep: boolean;
  isSelected: boolean;
  isCopied: boolean;
  issues: CellIssues;
  execState: CellExecutionState | undefined;
}

/**
 * One matrix body cell. Memoized so top-level transient state in MatrixSheet
 * (rename text, drag-over ids, resize mousemove) does not re-render the whole
 * O(rows × cols) grid — only cells whose props actually changed re-render.
 */
export const GridCell = React.memo<GridCellProps>(function GridCell({
  cell,
  cellKey,
  rowId,
  colId,
  width,
  minWidth,
  height,
  isActiveStep,
  isSelected,
  isCopied,
  issues,
  execState,
}) {
  const selectCell = useMatrixEditorStore((s) => s.selectCell);
  const openModal = useMatrixEditorStore((s) => s.openModal);

  const actionsList = useMemo(() => getCellActions(cell), [cell]);
  const allInputs = useMemo(
    () => Array.from(new Set(actionsList.flatMap((a) => a.inputs || []))),
    [actionsList],
  );
  const allOutputs = useMemo(
    () => Array.from(new Set(actionsList.flatMap((a) => a.outputs || []))),
    [actionsList],
  );

  // Derived subscription: when the inspector hovers a variable, only cells
  // that produce or consume it re-render.
  const hoveredVarRole = useMatrixEditorStore((s) => {
    if (!s.hoveredVariableKey) return null;
    if (allOutputs.includes(s.hoveredVariableKey)) return "producer";
    if (allInputs.includes(s.hoveredVariableKey)) return "consumer";
    return null;
  });

  const hasContent = actionsList.length > 0;
  const hasUnresolved = issues.unresolvedInputs.length > 0;
  const hasClash = issues.clashingOutputs.length > 0;

  return (
    <td
      data-cell-key={cellKey}
      role="gridcell"
      aria-selected={isSelected}
      onClick={() => selectCell(rowId, colId)}
      onDoubleClick={() => {
        selectCell(rowId, colId);
        openModal("cellEditor");
      }}
      style={{ width, minWidth, height }}
      className={`relative border-r border-b border-slate-200 p-2 align-top transition-all cursor-pointer group ${
        isActiveStep
          ? "bg-slate-50"
          : isSelected
            ? "bg-slate-100/80"
            : isCopied
              ? "bg-amber-50/50"
              : "hover:bg-slate-50/60"
      }`}
    >
      {isSelected ? (
        <div className="absolute inset-0 pointer-events-none z-cell-state border-2 border-slate-800 shadow-sm" />
      ) : null}

      {isCopied ? (
        <div className="absolute inset-0 pointer-events-none z-cell-state border-2 border-dashed border-amber-500 animate-pulse" />
      ) : null}

      {hoveredVarRole === "producer" ? (
        <div className="absolute inset-0 pointer-events-none z-cell-state border-2 border-emerald-500 bg-emerald-50/40" />
      ) : null}

      {hoveredVarRole === "consumer" ? (
        <div className="absolute inset-0 pointer-events-none z-cell-state border-2 border-dashed border-sky-500 bg-sky-50/40" />
      ) : null}

      {/* Overlay, not in-flow: exec feedback appears on inspector hover and
          must never change the cell's height (layout shift). */}
      {execState ? (
        <div className="absolute bottom-1 right-1 pointer-events-none z-cell-state flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50/95 px-1.5 py-0.5 text-[9px] text-emerald-700 font-mono shadow-sm">
          <span>✓ Ran</span>
          <span>{execState.latencyMs}ms</span>
        </div>
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
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-slate-300 text-[10px] italic">
          Empty
        </div>
      )}
    </td>
  );
});
