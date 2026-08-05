import React from "react";
import {
  selectActiveAction,
  useCellEditorStore,
} from "@/stores/cell-editor.store";
import { IntellisenseInput } from "../intellisense-input.component";

export interface ExpressionEditorProps {
  availableVariables: string[];
}

export function ExpressionEditor({
  availableVariables,
}: ExpressionEditorProps) {
  const activeAction = useCellEditorStore(selectActiveAction);
  const updateActiveAction = useCellEditorStore((s) => s.updateActiveAction);

  if (!activeAction) return null;

  return (
    <div className="space-y-4 bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
      <div className="space-y-1">
        <label className="font-bold text-slate-800 text-xs block">
          Output Variable Name:
        </label>
        <input
          type="text"
          value={activeAction.expressionConfig?.outputVariable || ""}
          onChange={(e) =>
            updateActiveAction((act) => ({
              ...act,
              outputs: [e.target.value],
              expressionConfig: {
                expression: act.expressionConfig?.expression || "",
                outputVariable: e.target.value,
              },
            }))
          }
          placeholder="e.g. calculatedLimit"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:outline-none focus:border-emerald-600"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="font-bold text-slate-800 text-xs block">
            TEL Expression Formula:
          </label>
          <span className="text-[10px] text-slate-400 font-mono">
            Type functions like min(), max(), floor(), coalesce() with
            Intellisense
          </span>
        </div>
        <IntellisenseInput
          mode="expression"
          multiline
          availableVariables={availableVariables}
          value={activeAction.expressionConfig?.expression || ""}
          onChange={(newExpr) =>
            updateActiveAction((act) => ({
              ...act,
              expressionConfig: {
                expression: newExpr,
                outputVariable: act.expressionConfig?.outputVariable || "",
              },
            }))
          }
          placeholder="e.g. min(floor(creditScore * 1.1), max(minLimit, 800))"
          className="w-full h-24 p-3 rounded-lg bg-slate-900 text-emerald-300 font-mono text-xs border border-slate-700 focus:outline-none focus:border-emerald-500"
        />
      </div>
    </div>
  );
}
