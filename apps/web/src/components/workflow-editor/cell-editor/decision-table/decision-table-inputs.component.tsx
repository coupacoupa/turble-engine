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
import { InputSourceOption } from "../cell-editor-modal.component";

export interface DecisionTableInputsProps {
  filteredInputOptions: InputSourceOption[];
}

export function DecisionTableInputs({
  filteredInputOptions,
}: DecisionTableInputsProps) {
  const matrix = useMatrixEditorStore((s) => s.matrix);
  const row = useMatrixEditorStore(selectSelectedRow);
  const column = useMatrixEditorStore(selectSelectedCol);
  const hoverInputKey = useMatrixEditorStore((s) => s.hoverInputKey);

  const activeAction = useCellEditorStore(selectActiveAction);
  const activeActionIndex = useCellEditorStore(selectActiveActionIndex);
  const inputSearchQuery = useCellEditorStore((s) => s.inputSearchQuery);
  const showInputDropdown = useCellEditorStore((s) => s.showInputDropdown);

  const setInputSearchQuery = useCellEditorStore((s) => s.setInputSearchQuery);
  const setShowInputDropdown = useCellEditorStore(
    (s) => s.setShowInputDropdown,
  );
  const addInputTag = useCellEditorStore((s) => s.addInputTag);
  const removeInputTag = useCellEditorStore((s) => s.removeInputTag);

  if (!row || !column || !activeAction) return null;

  const inputKeys = activeAction.inputs || [];

  return (
    <div className="space-y-1.5 relative">
      <div className="flex items-center justify-between">
        <label className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>INPUTS (Condition Sources):</span>
        </label>
        <span className="text-[10px] text-slate-400 font-mono">
          Select workflow or preceding cell outputs
        </span>
      </div>

      <div className="relative">
        <div
          onClick={() => {
            const inputEl = document.getElementById(
              `input-tag-search-${activeAction.id}`,
            );
            inputEl?.focus();
          }}
          className="flex flex-wrap gap-1.5 p-2 bg-white border border-slate-300 rounded-lg min-h-10.5 items-center focus-within:ring-1 focus-within:ring-slate-400 focus-within:border-slate-400 transition-all cursor-text shadow-2xs"
        >
          {inputKeys.map((key) => {
            const isResolved = matrix
              ? WorkflowValidationService.isInputResolved(
                  key,
                  matrix,
                  row.id,
                  column.id,
                  activeActionIndex,
                )
              : true;

            return (
              <span
                key={key}
                onMouseEnter={() => hoverInputKey(key)}
                onMouseLeave={() => hoverInputKey(null)}
                title={
                  isResolved
                    ? "Resolved input source"
                    : `Unresolved input: '${key}' is not produced by any preceding cell or workflow input`
                }
                className={`px-2 py-1 rounded font-mono text-[11px] flex items-center space-x-1 shadow-2xs font-bold transition-colors cursor-pointer ${
                  isResolved
                    ? "bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200"
                    : "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                }`}
              >
                {!isResolved && (
                  <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                )}
                <span>{key}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeInputTag(key);
                  }}
                  className={`p-0.5 rounded cursor-pointer ${
                    isResolved
                      ? "text-slate-500 hover:text-slate-800"
                      : "text-amber-700 hover:text-amber-950"
                  }`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}

          <input
            id={`input-tag-search-${activeAction.id}`}
            type="text"
            value={inputSearchQuery}
            onChange={(e) => {
              setInputSearchQuery(e.target.value);
              setShowInputDropdown(true);
            }}
            onFocus={() => setShowInputDropdown(true)}
            onBlur={() => setShowInputDropdown(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                if (inputSearchQuery.trim()) {
                  addInputTag(inputSearchQuery);
                  setShowInputDropdown(false);
                }
              } else if (
                e.key === "Backspace" &&
                !inputSearchQuery &&
                inputKeys.length > 0
              ) {
                removeInputTag(inputKeys[inputKeys.length - 1]!);
              }
            }}
            placeholder={
              inputKeys.length === 0
                ? "Search inputs or type & press Enter..."
                : "Search or type & press Enter..."
            }
            className="flex-1 min-w-45 bg-transparent font-mono text-xs text-slate-900 focus:outline-none placeholder-slate-400 py-0.5"
          />
        </div>

        {showInputDropdown && (
          <div
            // Keep focus in the search input while clicking options: without
            // this, mousedown blurs the input and the dropdown closes/flickers
            // mid-click (which the old 200ms blur timeout papered over).
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 font-mono text-xs"
          >
            {filteredInputOptions.length === 0 ? (
              <div className="p-3 text-slate-400 text-center text-[11px]">
                {inputSearchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      addInputTag(inputSearchQuery);
                      setShowInputDropdown(false);
                    }}
                    className="text-emerald-600 hover:underline font-bold"
                  >
                    + Add custom input tag &quot;{inputSearchQuery}&quot; (Press
                    Enter)
                  </button>
                ) : (
                  "No available preceding inputs found."
                )}
              </div>
            ) : (
              filteredInputOptions.map((opt) => (
                <div
                  key={opt.key}
                  onMouseEnter={() => hoverInputKey(opt.key)}
                  onMouseLeave={() => hoverInputKey(null)}
                  onClick={() => {
                    addInputTag(opt.key);
                    // Closing unmounts the option before mouseleave can fire,
                    // so clear the hover highlight here.
                    hoverInputKey(null);
                    setShowInputDropdown(false);
                  }}
                  className="px-3 py-2 hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <span className="font-bold text-slate-800">{opt.key}</span>
                  <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    {opt.source}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
