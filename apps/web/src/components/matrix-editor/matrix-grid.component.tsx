import React from 'react';
import { Plus, Shield, Layers, PlusCircle, Trash2, Cpu } from 'lucide-react';
import { MatrixSchema, DomainRowSchema, StepColumnSchema, RowType, CellSchema } from '../../types/matrix.types';

interface MatrixGridProps {
  matrix: MatrixSchema;
  activeStepIndex?: number;
  activeCellId?: string;
  onSelectCell: (row: DomainRowSchema, col: StepColumnSchema, cell?: CellSchema) => void;
  onAddColumn: () => void;
  onAddRow: (type: RowType) => void;
  onToggleInterceptor: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onDeleteColumn: (colId: string) => void;
}

export const MatrixGrid: React.FC<MatrixGridProps> = ({
  matrix,
  activeStepIndex,
  activeCellId,
  onSelectCell,
  onAddColumn,
  onAddRow,
  onToggleInterceptor,
  onDeleteRow,
  onDeleteColumn,
}) => {
  const sortedCols = [...matrix.columns].sort((a, b) => a.order - b.order);
  const sortedRows = [...matrix.rows].sort((a, b) => a.order - b.order);

  return (
    <div className="w-full overflow-x-auto border border-slate-200 rounded-xl bg-white font-sans text-xs shadow-sm">
      <table className="w-full text-left border-collapse">
        {/* Step Column Headers */}
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-mono">
            <th className="w-12 border-r border-slate-200 p-3 text-center text-slate-400 font-bold">#</th>
            <th className="w-64 border-r border-slate-200 p-3 font-sans font-bold text-slate-800">
              Domain Rows (Functional Services)
            </th>
            {sortedCols.map((col, cIdx) => {
              const isActiveStep = activeStepIndex === cIdx;
              return (
                <th
                  key={col.id}
                  className={`p-3 border-r border-slate-200 min-w-[240px] transition-colors relative group ${
                    isActiveStep
                      ? 'bg-emerald-50 text-emerald-900 font-bold border-b-2 border-b-emerald-600'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{col.label}</span>
                    <button
                      onClick={() => onDeleteColumn(col.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Delete Column"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </th>
              );
            })}
            <th className="p-3 w-32 text-center bg-slate-50">
              <button
                onClick={onAddColumn}
                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-mono text-[11px] font-semibold flex items-center justify-center space-x-1 w-full transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="h-3 w-3 text-emerald-600" />
                <span>Add Step</span>
              </button>
            </th>
          </tr>
        </thead>

        {/* Matrix Rows & Cells */}
        <tbody className="divide-y divide-slate-200 font-mono text-xs">
          {sortedRows.map((row, rIdx) => (
            <tr key={row.id} className={row.isInterceptor ? 'bg-amber-50/40' : 'bg-white'}>
              {/* Row Order Number */}
              <td className="p-3 text-center bg-slate-50 border-r border-slate-200 text-slate-400 font-bold">
                {rIdx + 1}
              </td>

              {/* Row Header Info & Controls */}
              <td className="p-3 border-r border-slate-200 font-sans font-bold text-slate-800 relative group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {row.type === 'workflow' ? (
                      <Layers className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                    ) : (
                      <Cpu className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    )}
                    <span className="text-xs">{row.label}</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onToggleInterceptor(row.id)}
                      className={`p-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                        row.isInterceptor
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'text-slate-400 hover:text-slate-700 border-transparent'
                      }`}
                      title="Toggle Always-Run Global Interceptor"
                    >
                      <Shield className="h-3 w-3" />
                    </button>

                    <button
                      onClick={() => onDeleteRow(row.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Delete Row"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 mt-1 font-mono text-[10px]">
                  <span className={`px-1.5 py-0.2 rounded border font-semibold ${
                    row.type === 'workflow'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {row.type.toUpperCase()} ROW
                  </span>

                  {row.isInterceptor && (
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold">
                      ALWAYS-RUN
                    </span>
                  )}
                </div>
              </td>

              {/* Step Cells for this Row */}
              {sortedCols.map((col, cIdx) => {
                const cellKey = `${row.id}:${col.id}`;
                const cell = matrix.cells[cellKey];
                const isActiveStep = activeStepIndex === cIdx;
                const isSelectedCell = activeCellId === cell?.id;

                let actionLabel = 'PASSTHROUGH';
                let actionBadgeColor = 'bg-slate-100 text-slate-600 border-slate-200';

                if (cell?.action === 'table_rule') {
                  actionLabel = `RULES (${cell.tableRuleConfig?.rules?.length || 0})`;
                  actionBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-300';
                } else if (cell?.action === 'expression') {
                  actionLabel = 'EXPRESSION';
                  actionBadgeColor = 'bg-blue-50 text-blue-700 border-blue-300';
                } else if (cell?.action === 'trigger_sub_workflow') {
                  actionLabel = 'SUB-WORKFLOW';
                  actionBadgeColor = 'bg-purple-50 text-purple-700 border-purple-300';
                }

                return (
                  <td
                    key={col.id}
                    onClick={() => onSelectCell(row, col, cell)}
                    className={`p-3 border-r border-slate-200 cursor-pointer transition-all hover:bg-slate-50 ${
                      isSelectedCell ? 'ring-2 ring-emerald-500 bg-emerald-50/20' : ''
                    } ${isActiveStep ? 'bg-emerald-50/40' : ''}`}
                  >
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-1.5 font-mono text-[11px] group">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">[{row.id}:{col.id}]</span>
                        <span className={`px-1.5 py-0.2 rounded border font-bold ${actionBadgeColor}`}>
                          {actionLabel}
                        </span>
                      </div>

                      <div className="text-slate-800 font-semibold truncate">
                        {cell?.action === 'table_rule'
                          ? cell.tableRuleConfig?.rules[0]?.mutations
                            ? JSON.stringify(cell.tableRuleConfig.rules[0].mutations)
                            : 'Match Rules'
                          : cell?.action === 'expression'
                          ? cell.expressionConfig?.expression || 'Formula'
                          : cell?.action === 'trigger_sub_workflow'
                          ? `Sub-WF: ${row.subWorkflowId || 'default'}`
                          : 'Passthrough'}
                      </div>
                    </div>
                  </td>
                );
              })}

              <td className="p-3 bg-white" />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Bottom Add Row Controls */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-sans">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onAddRow('plain')}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-mono text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <PlusCircle className="h-3.5 w-3.5 text-emerald-600" />
            <span>Add Plain Domain Row</span>
          </button>

          <button
            onClick={() => onAddRow('workflow')}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-mono text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <PlusCircle className="h-3.5 w-3.5 text-purple-600" />
            <span>Add Sub-Workflow Row</span>
          </button>
        </div>

        <div className="text-slate-500 font-mono text-[11px]">
          Matrix Bounds: {sortedRows.length} Rows × {sortedCols.length} Columns
        </div>
      </div>
    </div>
  );
};
