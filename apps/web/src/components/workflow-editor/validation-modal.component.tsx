import React from "react";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  Shield,
  Layers,
  FileCode,
} from "lucide-react";
import { MatrixSchema } from "@/types/matrix.types";

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  matrix: MatrixSchema;
}

interface IssueItem {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  description: string;
}

export const ValidationModal: React.FC<ValidationModalProps> = ({
  isOpen,
  onClose,
  matrix,
}) => {
  if (!isOpen) return null;

  const totalCols = matrix.columns.length;
  const totalRows = matrix.rows.length;
  const expectedTotalCells = totalCols * totalRows;
  const configuredCellKeys = Object.keys(matrix.cells);

  const issues: IssueItem[] = [];

  // Check 1: Empty Grid
  if (totalCols === 0 || totalRows === 0) {
    issues.push({
      id: "empty_grid",
      type: "error",
      title: "Grid bounds incomplete",
      description:
        "The matrix must have at least 1 row and 1 step column to execute.",
    });
  }

  // Check 2: Unconfigured passthrough cells ratio
  const passthroughCount = expectedTotalCells - configuredCellKeys.length;
  if (passthroughCount > 0 && expectedTotalCells > 0) {
    issues.push({
      id: "passthrough_cells",
      type: "info",
      title: `${passthroughCount} Passthrough Cell(s)`,
      description: `${passthroughCount} of ${expectedTotalCells} cells use identity passthrough logic. Data will pass through unchanged.`,
    });
  }

  // Check 3: Sub-Workflow link validation
  matrix.rows.forEach((row) => {
    if (row.type === "workflow" && !row.subWorkflowId) {
      issues.push({
        id: `missing_subwf_${row.id}`,
        type: "warning",
        title: `Unlinked Sub-Workflow in "${row.label}"`,
        description: "This sub-workflow row has no target workflow linked.",
      });
    }
  });

  // Check 4: Interceptors summary
  const interceptorRows = matrix.rows.filter((r) => r.isInterceptor);
  if (interceptorRows.length > 0) {
    issues.push({
      id: "interceptors_found",
      type: "info",
      title: `${interceptorRows.length} Always-Run Interceptor Row(s)`,
      description: `Rows (${interceptorRows.map((r) => r.label).join(", ")}) are configured as global interceptors.`,
    });
  }

  const hasErrors = issues.some((i) => i.type === "error");
  const hasWarnings = issues.some((i) => i.type === "warning");

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 font-sans select-none">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Matrix Rule Audit & Validation
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Summary Banner */}
          <div
            className={`p-3.5 rounded-lg border flex items-start space-x-3 ${
              hasErrors
                ? "bg-rose-50 border-rose-200 text-rose-950"
                : hasWarnings
                  ? "bg-amber-50 border-amber-200 text-amber-950"
                  : "bg-emerald-50 border-emerald-200 text-emerald-950"
            }`}
          >
            {hasErrors ? (
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            ) : hasWarnings ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            )}

            <div>
              <div className="font-bold text-sm">
                {hasErrors
                  ? "Validation Issues Found"
                  : hasWarnings
                    ? "Warnings Identified"
                    : "Matrix Ready for Execution"}
              </div>
              <div className="text-xs opacity-90 mt-0.5 font-mono">
                {matrix.name} • {totalRows} Rows × {totalCols} Step Columns
              </div>
            </div>
          </div>

          {/* Checklist Items */}
          <div className="space-y-2.5">
            {issues.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-lg text-center text-slate-500 font-mono text-xs">
                All matrix cells and sub-workflows passed validation checks
                cleanly.
              </div>
            ) : (
              issues.map((issue) => (
                <div
                  key={issue.id}
                  className="p-3 bg-white border border-slate-200 rounded-lg flex items-start space-x-3 shadow-2xs font-mono"
                >
                  {issue.type === "error" && (
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  {issue.type === "warning" && (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  {issue.type === "info" && (
                    <Info className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}

                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="font-bold text-slate-800 text-xs">
                      {issue.title}
                    </div>
                    <div className="text-slate-500 text-[11px] leading-relaxed">
                      {issue.description}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
