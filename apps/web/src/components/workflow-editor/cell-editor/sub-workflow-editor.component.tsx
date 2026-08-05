import React from "react";
import { useCellEditorStore } from "@/stores/cell-editor.store";
import {
  selectSelectedRow,
  useMatrixEditorStore,
} from "@/stores/matrix-editor.store";
import { MatrixSchema } from "@/types/matrix.types";
import { parseJsonRecord } from "@/utils/json-record.util";

export interface SubWorkflowEditorProps {
  availableSubWorkflows?: MatrixSchema[];
}

export function SubWorkflowEditor({
  availableSubWorkflows = [],
}: SubWorkflowEditorProps) {
  const row = useMatrixEditorStore(selectSelectedRow);
  const selectSubWorkflow = useMatrixEditorStore((s) => s.selectSubWorkflow);

  const inputMappingStr = useCellEditorStore((s) => s.inputMappingStr);
  const outputMappingStr = useCellEditorStore((s) => s.outputMappingStr);
  const setInputMappingStr = useCellEditorStore((s) => s.setInputMappingStr);
  const setOutputMappingStr = useCellEditorStore((s) => s.setOutputMappingStr);

  if (!row) return null;

  // Derived during render
  const inputMappingError = parseJsonRecord(inputMappingStr).error;
  const outputMappingError = parseJsonRecord(outputMappingStr).error;

  return (
    <div className="space-y-4 font-mono text-xs bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-900 space-y-2">
        <span className="font-semibold text-xs">
          Target Sub-Workflow Matrix:
        </span>

        <select
          value={row.subWorkflowId || ""}
          onChange={(e) => selectSubWorkflow(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded bg-white border border-purple-300 text-purple-950 font-mono text-xs focus:outline-none focus:border-purple-600"
        >
          {availableSubWorkflows.length > 0 ? (
            <>
              {!row.subWorkflowId ? (
                <option value="" disabled>
                  Select a sub-workflow…
                </option>
              ) : null}
              {availableSubWorkflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name} ({wf.id})
                </option>
              ))}
            </>
          ) : (
            <option value="">No sub-workflows available</option>
          )}
        </select>
      </div>

      <div className="space-y-1">
        <label className="font-semibold text-slate-700">
          Input Mappings (JSON):
        </label>
        <textarea
          rows={3}
          value={inputMappingStr}
          onChange={(e) => setInputMappingStr(e.target.value)}
          className={`w-full p-2 bg-white border rounded font-mono text-xs text-slate-800 focus:outline-none ${
            inputMappingError
              ? "border-rose-400 focus:border-rose-600"
              : "border-slate-300 focus:border-purple-600"
          }`}
        />
        {inputMappingError ? (
          <p className="text-[10px] text-rose-600 font-bold">
            ⚠️ {inputMappingError}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label className="font-semibold text-slate-700">
          Output Mappings (JSON):
        </label>
        <textarea
          rows={3}
          value={outputMappingStr}
          onChange={(e) => setOutputMappingStr(e.target.value)}
          className={`w-full p-2 bg-white border rounded font-mono text-xs text-slate-800 focus:outline-none ${
            outputMappingError
              ? "border-rose-400 focus:border-rose-600"
              : "border-slate-300 focus:border-purple-600"
          }`}
        />
        {outputMappingError ? (
          <p className="text-[10px] text-rose-600 font-bold">
            ⚠️ {outputMappingError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
