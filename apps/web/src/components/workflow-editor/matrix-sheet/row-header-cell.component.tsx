import React, { useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { DomainRowSchema } from "@/types/matrix.types";
import { useMatrixEditorStore } from "@/stores/matrix-editor.store";
import { ResizeHandle } from "./resize-handle.component";

interface RowHeaderCellProps {
  row: DomainRowSchema;
  rowNum: number;
  width: number;
  height: number;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent, rowId: string) => void;
  onDragOver: (e: React.DragEvent, rowId: string) => void;
  onDrop: (e: React.DragEvent, rowId: string) => void;
  onDragEnd: () => void;
  onResizeStart: (e: React.MouseEvent, rowId: string) => void;
  onResizeReset: (rowId: string) => void;
}

/**
 * Memoized row header. Rename text is local state so keystrokes re-render
 * this header only, never the grid body.
 */
export const RowHeaderCell = React.memo<RowHeaderCellProps>(
  function RowHeaderCell({
    row,
    rowNum,
    width,
    height,
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
    const renameRow = useMatrixEditorStore((s) => s.renameRow);
    const deleteRow = useMatrixEditorStore((s) => s.deleteRow);

    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState("");

    const handleSaveName = () => {
      if (editText.trim()) {
        renameRow(row.id, editText.trim());
      }
      setIsEditing(false);
    };

    return (
      <td
        role="rowheader"
        aria-selected={isSelected}
        aria-label={`Row ${rowNum}: ${row.label}`}
        onDragOver={(e) => onDragOver(e, row.id)}
        onDrop={(e) => onDrop(e, row.id)}
        onDragEnd={onDragEnd}
        style={{ width, height }}
        className={`sticky left-0 z-sticky p-2.5 border-r border-b border-slate-200 group transition-all ${
          isDragging
            ? "opacity-30 border-2 border-dashed border-slate-400 bg-slate-100"
            : isDragOver
              ? "border-t-4 border-t-slate-700 bg-slate-200"
              : row.isInterceptor
                ? "bg-amber-100 text-amber-950"
                : isSelected
                  ? "bg-slate-200 text-slate-950 font-bold"
                  : "bg-slate-100 text-slate-800"
        }`}
      >
        {isSelected ? (
          <div className="absolute inset-0 pointer-events-none z-cell-state border border-slate-400 rounded-xs shadow-[0_0_0_1px_rgba(15,23,42,0.1)]" />
        ) : null}

        <div className="flex flex-col justify-center h-full space-y-1">
          <div className="flex items-center justify-between space-x-1.5 min-w-0">
            <div className="flex items-center space-x-1.5 min-w-0 flex-1">
              <div
                draggable={!isEditing}
                onDragStart={(e) => onDragStart(e, row.id)}
                className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-slate-300/70 transition-colors shrink-0"
                title="Drag handle to reorder row"
              >
                <GripVertical className="h-3.5 w-3.5 text-slate-500 hover:text-slate-800 shrink-0" />
              </div>
              <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-bold text-[10px] shrink-0">
                {rowNum}
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
                  className="font-sans font-bold text-xs bg-white border border-slate-400 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-slate-800 w-full min-w-0 shadow-2xs"
                />
              ) : (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditText(row.label);
                    setIsEditing(true);
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
          onMouseDown={(e) => onResizeStart(e, row.id)}
          onDoubleClick={() => onResizeReset(row.id)}
        />
      </td>
    );
  },
);
