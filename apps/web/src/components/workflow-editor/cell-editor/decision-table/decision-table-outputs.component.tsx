import React from "react";
import { AlertTriangle, X } from "lucide-react";
import {
  selectActiveAction,
  selectActiveActionIndex,
  useCellEditorStore,
} from "@/stores/cell-editor.store";
import {
  selectSelectedCol,
  selectSelectedRow,
  useMatrixEditorStore,
} from "@/stores/matrix-editor.store";
import { WorkflowValidationService } from "@/services/workflow-validation.service";

export function DecisionTableOutputs() {
  const matrix = useMatrixEditorStore((s) => s.matrix);
  const row = useMatrixEditorStore(selectSelectedRow);
  const column = useMatrixEditorStore(selectSelectedCol);

  const activeAction = useCellEditorStore(selectActiveAction);
  const activeActionIndex = useCellEditorStore(selectActiveActionIndex);

  const outputInputText = useCellEditorStore((s) => s.outputInputText);
  const setOutputInputText = useCellEditorStore((s) => s.setOutputInputText);
  const addOutputTag = useCellEditorStore((s) => s.addOutputTag);
  const removeOutputTag = useCellEditorStore((s) => s.removeOutputTag);

  if (!row || !column || !activeAction) return null;

  const outputKeys = activeAction.outputs || [];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span>OUTPUTS (Cell Mutated Variables):</span>
        </label>
        <span className="text-[10px] text-slate-400 font-mono">
          Type variable names produced by this cell
        </span>
      </div>

      <div
        onClick={() => {
          const outputEl = document.getElementById(
            `output-tag-text-${activeAction.id}`,
          );
          outputEl?.focus();
        }}
        className="flex flex-wrap gap-1.5 p-2 bg-white border border-slate-300 rounded-lg min-h-10.5 items-center focus-within:ring-1 focus-within:ring-slate-400 focus-within:border-slate-400 transition-all cursor-text shadow-2xs"
      >
        {outputKeys.map((key) => {
          const clashInfo = matrix
            ? WorkflowValidationService.isOutputClashing(
                key,
                matrix,
                row.id,
                column.id,
                activeActionIndex,
              )
            : { clashing: false };

          return (
            <span
              key={key}
              title={clashInfo.clashing ? clashInfo.reason : "Valid output key"}
              className={`px-2 py-1 rounded font-mono text-[11px] flex items-center space-x-1 shadow-2xs font-bold transition-colors cursor-pointer ${
                clashInfo.clashing
                  ? "bg-rose-100 text-rose-950 border border-rose-300 hover:bg-rose-200"
                  : "bg-slate-100 text-slate-800 border border-slate-200"
              }`}
            >
              {clashInfo.clashing && (
                <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
              )}
              <span>{key}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeOutputTag(key);
                }}
                className={`p-0.5 rounded cursor-pointer ${
                  clashInfo.clashing
                    ? "text-rose-700 hover:text-rose-950"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}

        <input
          id={`output-tag-text-${activeAction.id}`}
          type="text"
          value={outputInputText}
          onChange={(e) => setOutputInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addOutputTag(outputInputText);
            } else if (
              e.key === "Backspace" &&
              !outputInputText &&
              outputKeys.length > 0
            ) {
              removeOutputTag(outputKeys[outputKeys.length - 1]!);
            }
          }}
          placeholder={
            outputKeys.length === 0
              ? "Type output variable name & press Enter..."
              : "Type output name & press Enter..."
          }
          className="flex-1 min-w-50 bg-transparent font-mono text-xs text-slate-900 focus:outline-none placeholder-slate-400 py-0.5"
        />
      </div>
    </div>
  );
}
