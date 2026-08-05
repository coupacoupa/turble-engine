import React from "react";
import { ChevronDown, Layers, Plus } from "lucide-react";
import { useCellEditorStore } from "@/stores/cell-editor.store";
import { ActionDropdownMenu } from "./action-dropdown-menu.component";
import { ActionTableRow } from "./action-table-row.component";

export interface CellActionSequenceProps {
  isStandardRow: boolean;
}

export function CellActionSequence({ isStandardRow }: CellActionSequenceProps) {
  const actions = useCellEditorStore((s) => s.actions);
  const isAddDropdownOpen = useCellEditorStore((s) => s.isAddDropdownOpen);
  const setIsAddDropdownOpen = useCellEditorStore(
    (s) => s.setIsAddDropdownOpen,
  );

  return (
    <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 font-bold text-slate-800 text-xs">
          <Layers className="h-4 w-4 text-slate-500" />
          <span>Cell Action Sequence ({actions.length})</span>
        </div>

        {/* Dropdown Button: + New Cell Action */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsAddDropdownOpen((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-mono text-xs flex items-center space-x-1.5 font-bold cursor-pointer transition-colors shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Cell Action</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${isAddDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Available Action Types Dropdown Menu */}
          {isAddDropdownOpen && (
            <ActionDropdownMenu isStandardRow={isStandardRow} />
          )}
        </div>
      </div>

      {/* Sequence Actions Table */}
      <div className="overflow-hidden border border-slate-200 rounded-lg shadow-2xs">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
              <th className="py-2 px-3 text-center w-10 font-bold">#</th>
              <th className="py-2 px-3 text-left font-bold">Action Type</th>
              <th className="py-2 px-3 text-left font-bold">Inputs</th>
              <th className="py-2 px-3 text-left font-bold">Outputs</th>
              <th className="py-2 px-3 text-left font-bold">Rules / Details</th>
              <th className="py-2 px-3 text-right w-20 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {actions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-4 text-center text-slate-400 text-xs"
                >
                  No cell actions configured. Click &quot;New Cell Action&quot;
                  above.
                </td>
              </tr>
            ) : (
              actions.map((act, idx) => (
                <ActionTableRow
                  key={act.id}
                  action={act}
                  index={idx}
                  totalActions={actions.length}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
