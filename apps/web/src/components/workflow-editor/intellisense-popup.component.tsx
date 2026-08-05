import React from "react";
import { createPortal } from "react-dom";
import { SuggestionItem } from "@/hooks/use-expression-intellisense.hook";

export interface IntellisensePopupProps {
  suggestions: SuggestionItem[];
  selectedIndex: number;
  onSelect: (item: SuggestionItem) => void;
  isOpen: boolean;
  coords: { top: number; left: number; width: number };
}

export function IntellisensePopup({
  suggestions,
  selectedIndex,
  onSelect,
  isOpen,
  coords,
}: IntellisensePopupProps) {
  if (!isOpen || suggestions.length === 0 || typeof document === "undefined") {
    return null;
  }

  const popupWidth = Math.min(320, Math.max(220, coords.width));

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${popupWidth}px`,
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing input focus when clicking items
      className="z-popover max-h-52 overflow-y-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl shadow-slate-900/10 p-1 font-mono text-xs text-slate-800 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100"
    >
      {suggestions.map((item, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className={`flex flex-col gap-0.5 p-1.5 rounded-lg cursor-pointer transition-colors ${
              isSelected
                ? "bg-emerald-50 text-emerald-950 border border-emerald-300"
                : "hover:bg-slate-100 text-slate-700 border border-transparent"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center space-x-1.5 shrink-0">
                {item.kind === "variable" && (
                  <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    VAR
                  </span>
                )}
                {item.kind === "function" && (
                  <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    FN
                  </span>
                )}
                {item.kind === "keyword" && (
                  <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    KW
                  </span>
                )}
                <span className="font-bold text-[11px] text-slate-900 truncate">
                  {item.display}
                </span>
              </div>
              {item.detail && (
                <span className="text-[9px] text-slate-400 font-mono truncate max-w-28 text-right">
                  {item.detail}
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-[10px] font-sans text-slate-500 leading-tight line-clamp-1 pl-0.5">
                {item.description}
              </p>
            )}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
