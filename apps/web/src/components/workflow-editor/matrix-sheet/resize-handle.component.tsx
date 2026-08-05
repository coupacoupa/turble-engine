import React from "react";

export interface ResizeHandleProps {
  orientation: "col" | "row";
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  orientation,
  onMouseDown,
  onDoubleClick,
}) => {
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
