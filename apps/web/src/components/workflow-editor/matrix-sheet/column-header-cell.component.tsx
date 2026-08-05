import React, { useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { StepColumnSchema } from "@/types/matrix.types";
import { useMatrixEditorStore } from "@/stores/matrix-editor.store";
import { ResizeHandle } from "./resize-handle.component";

interface ColumnHeaderCellProps {
  col: StepColumnSchema;
  colLetter: string;
  width: number;
  minWidth: number;
  isActiveStep: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent, colId: string) => void;
  onDragOver: (e: React.DragEvent, colId: string) => void;
  onDrop: (e: React.DragEvent, colId: string) => void;
  onDragEnd: () => void;
  onResizeStart: (e: React.MouseEvent, colId: string) => void;
  onResizeReset: (colId: string) => void;
}

/**
 * Memoized column header. Rename text is local state so keystrokes re-render
 * this header only, never the grid body.
 */
export const ColumnHeaderCell = React.memo<ColumnHeaderCellProps>(
  function ColumnHeaderCell({
    col,
    colLetter,
    width,
    minWidth,
    isActiveStep,
    isSelected,
    isDragging,
    isDragOver,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onResizeStart,
    onResizeReset,
  }) {
    const renameColumn = useMatrixEditorStore((s) => s.renameColumn);
    const deleteColumn = useMatrixEditorStore((s) => s.deleteColumn);

    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState("");

    const handleSaveName = () => {
      if (editText.trim()) {
        renameColumn(col.id, editText.trim());
      }
      setIsEditing(false);
    };

    return (
      <th
        data-col-id={col.id}
        role="columnheader"
        aria-selected={isSelected}
        aria-label={`Column ${colLetter}: ${col.label}`}
        onDragOver={(e) => onDragOver(e, col.id)}
        onDrop={(e) => onDrop(e, col.id)}
        onDragEnd={onDragEnd}
        style={{ width, minWidth }}
        className={`sticky top-0 z-sticky border-r border-b border-slate-200 p-2.5 transition-all group ${
          isDragging
            ? "opacity-30 border-2 border-dashed border-slate-400 bg-slate-100"
            : isDragOver
              ? "border-l-4 border-l-slate-700 bg-slate-200"
              : isActiveStep
                ? "bg-slate-200 text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-800"
                : isSelected
                  ? "bg-slate-200 text-slate-900"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-800"
        }`}
      >
        {isSelected ? (
          <div className="absolute inset-0 pointer-events-none z-cell-state border border-slate-400 rounded-xs shadow-[0_0_0_1px_rgba(15,23,42,0.1)]" />
        ) : null}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 min-w-0 flex-1">
            <div
              draggable={!isEditing}
              onDragStart={(e) => onDragStart(e, col.id)}
              className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-slate-300/70 transition-colors shrink-0"
              title="Drag handle to reorder column"
            >
              <GripVertical className="h-3.5 w-3.5 text-slate-500 hover:text-slate-800 shrink-0" />
            </div>

            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold shrink-0">
              {colLetter}
            </span>

            {isEditing ? (
              <input
                type="text"
                value={editText}
                autoFocus
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") setIsEditing(false);
                }}
                onBlur={handleSaveName}
                onClick={(e) => e.stopPropagation()}
                className="font-bold text-slate-900 text-xs bg-white border border-slate-400 rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-slate-800 flex-1 min-w-22.5 shadow-xs"
              />
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setEditText(col.label);
                  setIsEditing(true);
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
          onMouseDown={(e) => onResizeStart(e, col.id)}
          onDoubleClick={() => onResizeReset(col.id)}
        />
      </th>
    );
  },
);
