import React from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import {
  selectActiveAction,
  useCellEditorStore,
} from "@/stores/cell-editor.store";
import { IntellisenseInput } from "../../intellisense-input.component";

export interface DecisionTableGridProps {
  availableVarKeys: string[];
}

export function DecisionTableGrid({
  availableVarKeys,
}: DecisionTableGridProps) {
  const activeAction = useCellEditorStore(selectActiveAction);

  const addDecisionTableRow = useCellEditorStore((s) => s.addDecisionTableRow);
  const removeDecisionTableRow = useCellEditorStore(
    (s) => s.removeDecisionTableRow,
  );
  const setCellCondition = useCellEditorStore((s) => s.setCellCondition);
  const setCellMutation = useCellEditorStore((s) => s.setCellMutation);

  if (!activeAction) return null;

  const inputKeys = activeAction.inputs || [];
  const outputKeys = activeAction.outputs || [];
  const rulesList = activeAction.tableRuleConfig?.rules || [];

  return (
    <div className="space-y-3 pt-2 border-t border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-4 w-4 text-slate-500" />
          <span className="font-bold text-slate-900 text-xs">
            Decision Table Rules Matrix
          </span>
        </div>

        <button
          type="button"
          onClick={addDecisionTableRow}
          className="px-2.5 py-1 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 font-mono text-[11px] flex items-center space-x-1 font-semibold cursor-pointer transition-colors"
        >
          <Plus className="h-3 w-3" />
          <span>Add Rule Row</span>
        </button>
      </div>

      {inputKeys.length === 0 && outputKeys.length === 0 ? (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-[11px] text-center">
          Please add at least one INPUT or OUTPUT tag above to populate Decision
          Table columns.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs bg-white">
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                <th className="p-2 border-r border-slate-200 text-center w-12 font-bold">
                  #
                </th>

                {/* Input Condition Columns */}
                {inputKeys.map((inpKey) => (
                  <th
                    key={`head_in_${inpKey}`}
                    className="p-2 border-r border-slate-200 bg-slate-50 text-slate-800 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{inpKey}</span>
                      <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded">
                        IF
                      </span>
                    </div>
                  </th>
                ))}

                {/* Output Mutation Columns */}
                {outputKeys.map((outKey) => (
                  <th
                    key={`head_out_${outKey}`}
                    className="p-2 border-r border-slate-200 bg-slate-50 text-slate-800 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{outKey}</span>
                      <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded">
                        SET
                      </span>
                    </div>
                  </th>
                ))}

                <th className="p-2 text-center w-12 font-bold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {rulesList.length === 0 ? (
                <tr>
                  <td
                    colSpan={1 + inputKeys.length + outputKeys.length + 1}
                    className="p-4 text-center text-slate-400 text-xs"
                  >
                    No rule rows configured yet. Click &quot;Add Rule Row&quot;
                    above.
                  </td>
                </tr>
              ) : (
                rulesList.map((rule, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/80">
                    <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-500">
                      {rIdx + 1}
                    </td>

                    {/* Condition Cells */}
                    {inputKeys.map((inpKey) => (
                      <td
                        key={`cell_in_${rIdx}_${inpKey}`}
                        className="p-1.5 border-r border-slate-200 min-w-36 relative"
                      >
                        <IntellisenseInput
                          mode="condition"
                          availableVariables={availableVarKeys}
                          value={rule.conditions[inpKey] ?? ""}
                          onChange={(newVal) =>
                            setCellCondition(rIdx, inpKey, newVal)
                          }
                          placeholder="e.g. >= 700"
                          className="w-full p-1 bg-white border border-slate-300 rounded text-slate-900 text-[11px] focus:outline-none focus:border-slate-500 font-mono"
                        />
                      </td>
                    ))}

                    {/* Mutation Cells */}
                    {outputKeys.map((outKey) => (
                      <td
                        key={`cell_out_${rIdx}_${outKey}`}
                        className="p-1.5 border-r border-slate-200 min-w-36 relative"
                      >
                        <IntellisenseInput
                          mode="mutation"
                          availableVariables={availableVarKeys}
                          value={rule.mutations[outKey] ?? ""}
                          onChange={(newVal) =>
                            setCellMutation(rIdx, outKey, newVal)
                          }
                          placeholder="e.g. APPROVED"
                          className="w-full p-1 bg-white border border-slate-300 rounded text-slate-900 text-[11px] focus:outline-none focus:border-slate-500 font-mono"
                        />
                      </td>
                    ))}

                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeDecisionTableRow(rIdx)}
                        className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                        title="Delete rule row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
