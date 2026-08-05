import React from "react";
import { InputSourceOption } from "../cell-editor-modal.component";
import { DecisionTableGrid } from "./decision-table-grid.component";
import { DecisionTableInputs } from "./decision-table-inputs.component";
import { DecisionTableOutputs } from "./decision-table-outputs.component";

export interface DecisionTableEditorProps {
  filteredInputOptions: InputSourceOption[];
  availableVarKeys: string[];
}

export function DecisionTableEditor({
  filteredInputOptions,
  availableVarKeys,
}: DecisionTableEditorProps) {
  return (
    <div className="space-y-4 bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
      {/* 1. INPUTS Setup */}
      <DecisionTableInputs filteredInputOptions={filteredInputOptions} />

      {/* 2. OUTPUTS Setup */}
      <DecisionTableOutputs />

      {/* 3. Decision Table Rules Matrix */}
      <DecisionTableGrid availableVarKeys={availableVarKeys} />
    </div>
  );
}
