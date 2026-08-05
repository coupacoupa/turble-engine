import React from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useCellEditorStore } from "@/stores/cell-editor.store";
import { CellActionItem, CellActionType } from "@/types/matrix.types";

export interface ActionTableRowProps {
  action: CellActionItem;
  index: number;
  totalActions: number;
}

function getActionTypeLabel(type: CellActionType): string {
  switch (type) {
    case "table_rule":
      return "Decision Table Rules";
    case "expression":
      return "Expression TEL";
    case "trigger_sub_workflow":
      return "Trigger Bound Sub-Workflow";
    case "override_sub_workflow":
      return "Sub-Workflow Overrides";
    case "skip_sub_workflow":
      return "Skip Sub-Workflow";
    default:
      return type;
  }
}

function getActionTypeBadgeStyle(type: CellActionType): string {
  switch (type) {
    case "table_rule":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "expression":
      return "bg-indigo-100 text-indigo-900 border-indigo-200";
    default:
      return "bg-purple-100 text-purple-900 border-purple-200";
  }
}

function getActionSummaryText(
  type: CellActionType,
  ruleCount: number,
  expressionFormula?: string,
): string {
  switch (type) {
    case "table_rule":
      return `${ruleCount} rules`;
    case "expression":
      return expressionFormula
        ? `Formula: ${expressionFormula}`
        : "Expression calculation";
    default:
      return "Sub-Workflow Step";
  }
}

export function ActionTableRow({
  action,
  index,
  totalActions,
}: ActionTableRowProps) {
  const activeActionId = useCellEditorStore((s) => s.activeActionId);
  const setActiveActionId = useCellEditorStore((s) => s.setActiveActionId);
  const moveAction = useCellEditorStore((s) => s.moveAction);
  const removeAction = useCellEditorStore((s) => s.removeAction);

  const isSelected = action.id === activeActionId;
  const ruleCount = action.tableRuleConfig?.rules?.length || 0;

  return (
    <tr
      onClick={() => setActiveActionId(action.id)}
      className={`cursor-pointer transition-colors relative ${
        isSelected
          ? "bg-emerald-50/90 text-slate-900 font-medium border-l-2 border-l-emerald-600 shadow-2xs"
          : "hover:bg-slate-50/80 text-slate-700"
      }`}
    >
      <td className="py-2 px-3 font-bold text-slate-400 text-center">
        #{index + 1}
      </td>
      <td className="py-2 px-3">
        <span
          className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getActionTypeBadgeStyle(
            action.type,
          )}`}
        >
          {getActionTypeLabel(action.type)}
        </span>
      </td>
      <td className="py-2 px-3 truncate max-w-32.5">
        {action.inputs && action.inputs.length > 0 ? (
          <span className="text-emerald-700 font-bold">
            {action.inputs.join(", ")}
          </span>
        ) : (
          <span className="text-slate-400 italic">None</span>
        )}
      </td>
      <td className="py-2 px-3 truncate max-w-32.5">
        {action.outputs && action.outputs.length > 0 ? (
          <span className="text-purple-700 font-bold">
            {action.outputs.join(", ")}
          </span>
        ) : (
          <span className="text-slate-400 italic">None</span>
        )}
      </td>
      <td className="py-2 px-3 text-slate-500 text-[11px] truncate max-w-36">
        {getActionSummaryText(
          action.type,
          ruleCount,
          action.expressionConfig?.expression,
        )}
      </td>
      <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end space-x-1">
          {index > 0 && (
            <button
              type="button"
              onClick={() => moveAction(index, "up")}
              className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
              title="Move action up"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
          )}
          {index < totalActions - 1 && (
            <button
              type="button"
              onClick={() => moveAction(index, "down")}
              className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
              title="Move action down"
            >
              <ArrowDown className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => removeAction(action.id)}
            className="p-1 hover:bg-rose-100 text-rose-600 rounded cursor-pointer"
            title="Delete action"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}
