import React from "react";
import { CellActionType } from "@/types/matrix.types";

export interface ActionTypeOption {
  type: CellActionType;
  title: string;
  description: string;
  dotColor: string;
  hoverBg: string;
  textColor: string;
}

export interface ActionMenuItemProps {
  option: ActionTypeOption;
  onClick: () => void;
}

export function ActionMenuItem({ option, onClick }: ActionMenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-3 cursor-pointer space-y-0.5 transition-colors ${option.hoverBg}`}
    >
      <div
        className={`font-bold flex items-center space-x-1.5 ${option.textColor}`}
      >
        <span className={`w-2 h-2 rounded-full ${option.dotColor}`} />
        <span>{option.title}</span>
      </div>
      <div className="text-[10px] text-slate-500 font-sans leading-tight">
        {option.description}
      </div>
    </button>
  );
}
