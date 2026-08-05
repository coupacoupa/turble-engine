import React from "react";
import { useCellEditorStore } from "@/stores/cell-editor.store";
import { ActionMenuItem, ActionTypeOption } from "./action-menu-item.component";

export interface ActionDropdownMenuProps {
  isStandardRow: boolean;
}

const STANDARD_ACTION_OPTIONS: ActionTypeOption[] = [
  {
    type: "table_rule",
    title: "Decision Table Rules",
    description: "Evaluate condition rules & set output variables",
    dotColor: "bg-emerald-500",
    hoverBg: "hover:bg-emerald-50",
    textColor: "text-emerald-950",
  },
  {
    type: "expression",
    title: "Expression (TEL / Math & Calculations)",
    description: "Calculate values with math, string, and collection functions",
    dotColor: "bg-indigo-500",
    hoverBg: "hover:bg-indigo-50",
    textColor: "text-indigo-950",
  },
];

const SUBWORKFLOW_ACTION_OPTIONS: ActionTypeOption[] = [
  {
    type: "trigger_sub_workflow",
    title: "Trigger Bound Sub-Workflow",
    description: "Execute bound sub-workflow matrix",
    dotColor: "bg-purple-500",
    hoverBg: "hover:bg-purple-50",
    textColor: "text-purple-950",
  },
  {
    type: "override_sub_workflow",
    title: "Sub-Workflow with Parameter Overrides",
    description: "Pass custom override parameters",
    dotColor: "bg-purple-500",
    hoverBg: "hover:bg-purple-50",
    textColor: "text-purple-950",
  },
  {
    type: "skip_sub_workflow",
    title: "Skip Sub-Workflow Execution",
    description: "Bypass sub-workflow execution for this step",
    dotColor: "bg-slate-400",
    hoverBg: "hover:bg-slate-100",
    textColor: "text-slate-700",
  },
];

export function ActionDropdownMenu({ isStandardRow }: ActionDropdownMenuProps) {
  const addActionWithType = useCellEditorStore((s) => s.addActionWithType);
  const options = isStandardRow
    ? STANDARD_ACTION_OPTIONS
    : SUBWORKFLOW_ACTION_OPTIONS;

  return (
    <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-300 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 font-mono text-xs">
      {options.map((opt) => (
        <ActionMenuItem
          key={opt.type}
          option={opt}
          onClick={() => addActionWithType(opt.type)}
        />
      ))}
    </div>
  );
}
