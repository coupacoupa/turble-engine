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
import { useMatrixEditorStore } from "@/stores/matrix-editor.store";

interface ValidationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  matrix?: MatrixSchema;
}

interface IssueItem {
  id: string;
  type: "error" | "warning" | "info";
  title: string;
  description: string;
}

export const ValidationModal: React.FC<ValidationModalProps> = ({
  isOpen: propsIsOpen,
  onClose: propsOnClose,
  matrix: propsMatrix,
}) => {
  const storeIsOpen = useMatrixEditorStore((s) => s.isValidating);
  const storeSetIsOpen = useMatrixEditorStore((s) => s.setIsValidating);
  const storeMatrix = useMatrixEditorStore((s) => s.matrix);

  const isOpen = propsIsOpen ?? storeIsOpen;
  const onClose = propsOnClose ?? (() => storeSetIsOpen(false));
  const matrix = propsMatrix ?? storeMatrix;

  if (!isOpen || !matrix) return null;

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
        "The workflow matrix requires at least 1 row and 1 column step to execute rules.",
    });
  }

  // Check 2: Unconfigured Cells Count
  const configuredCount = configuredCellKeys.length;
  if (configuredCount === 0 && expectedTotalCells > 0) {
    issues.push({
      id: "no_cells_configured",
      type: "warning",
      title: "No grid cells configured",
      description:
        "All step cells are empty. The engine will evaluate passthrough for every step.",
    });
  }

  // Check 3: Inputs Defined
  const hasInputs = (matrix.inputs || []).length > 0;
  if (!hasInputs) {
    issues.push({
      id: "no_inputs",
      type: "info",
      title: "No workflow input schema defined",
      description:
        "No incoming parameters registered in the toolbar 'Inputs' schema manager.",
    });
  }

  // Check 4: Sub-workflow Row Configuration
  const subWfRows = matrix.rows.filter((r) => r.type === "workflow");
  subWfRows.forEach((r) => {
    if (!r.subWorkflowId) {
      issues.push({
        id: `unlinked_subwf_${r.id}`,
        type: "error",
        title: `Unlinked Sub-Workflow Row: ${r.label}`,
        description:
          "This row is typed as Sub-Workflow but has no linked target workflow matrix selected.",
      });
    }
  });

  const errorCount = issues.filter((i) => i.type === "error").length;
  const warningCount = issues.filter((i) => i.type === "warning").length;
  const isHealthy = errorCount === 0;

  return (
    <div className="fixed inset-0 z-modal bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-xl ${
                isHealthy
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-amber-100 text-amber-600"
              }`}
            >
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Workflow Matrix Audit & Health Check
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Static validation before local execution or publishing
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto min-h-0 text-xs font-mono">
          {/* Summary Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              isHealthy
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            <div className="flex items-center space-x-3">
              {isHealthy ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              )}
              <div>
                <span className="font-bold block">
                  {isHealthy
                    ? "Matrix is Valid & Ready for Execution"
                    : `${errorCount} Blocking Error${errorCount > 1 ? "s" : ""} Found`}
                </span>
                <span className="text-[11px] opacity-80">
                  {isHealthy
                    ? "All structural dependencies and boundaries look consistent."
                    : "Please fix structural issues before publishing."}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block text-[10px]">
                GRID SIZE
              </span>
              <span className="font-bold text-slate-800">
                {totalRows} Rows × {totalCols} Cols
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block text-[10px]">
                CONFIGURED CELLS
              </span>
              <span className="font-bold text-slate-800">
                {configuredCount} / {expectedTotalCells}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block text-[10px]">INPUTS</span>
              <span className="font-bold text-slate-800">
                {(matrix.inputs || []).length} Keys
              </span>
            </div>
          </div>

          {/* Issues List */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Audit Findings ({issues.length})
            </span>

            {issues.length === 0 ? (
              <div className="p-4 text-center text-slate-400 italic bg-slate-50 rounded-lg border border-slate-200">
                No audit issues found.
              </div>
            ) : (
              issues.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border flex items-start space-x-2.5 ${
                    item.type === "error"
                      ? "bg-red-50/70 border-red-200 text-red-900"
                      : item.type === "warning"
                        ? "bg-amber-50/70 border-amber-200 text-amber-900"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}
                >
                  {item.type === "error" ? (
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  ) : item.type === "warning" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <span className="font-bold block text-xs">
                      {item.title}
                    </span>
                    <span className="text-[11px] opacity-90 block">
                      {item.description}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs font-mono shadow-xs transition-colors cursor-pointer"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
