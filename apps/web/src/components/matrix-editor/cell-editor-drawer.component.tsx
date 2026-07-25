import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Sliders } from 'lucide-react';
import { MatrixSchema, DomainRowSchema, StepColumnSchema, CellSchema, CellActionType, TableRuleMatch } from '../../types/matrix.types';

interface CellEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  row?: DomainRowSchema;
  column?: StepColumnSchema;
  cell?: CellSchema;
  availableSubWorkflows?: MatrixSchema[];
  onSaveCell: (updatedCell: CellSchema) => void;
}

export const CellEditorDrawer: React.FC<CellEditorDrawerProps> = ({
  isOpen,
  onClose,
  row,
  column,
  cell,
  onSaveCell,
}) => {
  const [action, setAction] = useState<CellActionType>('passthrough');
  const [enabled, setEnabled] = useState(true);

  // Table rule state
  const [tableRules, setTableRules] = useState<TableRuleMatch[]>([]);

  // Expression state
  const [expression, setExpression] = useState('');
  const [outputVariable, setOutputVariable] = useState('');

  // Sub-workflow state
  const [inputMappingStr, setInputMappingStr] = useState('{}');
  const [outputMappingStr, setOutputMappingStr] = useState('{}');

  useEffect(() => {
    if (cell) {
      setAction(cell.action);
      setEnabled(cell.enabled ?? true);
      if (cell.tableRuleConfig) {
        setTableRules(cell.tableRuleConfig.rules || []);
      }
      if (cell.expressionConfig) {
        setExpression(cell.expressionConfig.expression || '');
        setOutputVariable(cell.expressionConfig.outputVariable || '');
      }
      if (cell.subWorkflowConfig) {
        setInputMappingStr(JSON.stringify(cell.subWorkflowConfig.inputMapping || {}, null, 2));
        setOutputMappingStr(JSON.stringify(cell.subWorkflowConfig.outputMapping || {}, null, 2));
      }
    } else if (row) {
      if (row.type === 'plain') setAction('table_rule');
      else setAction('trigger_sub_workflow');
      setTableRules([]);
      setExpression('');
      setOutputVariable('');
    }
  }, [cell, row]);

  if (!isOpen || !row || !column) return null;

  const isPlainRow = row.type === 'plain';

  const handleAddRule = () => {
    setTableRules((prev) => [
      ...prev,
      {
        conditions: { key: '>= 0' },
        mutations: { result: 'MATCHED' },
      },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setTableRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRuleConditionChange = (index: number, key: string, cond: string) => {
    setTableRules((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          ...next[index]!,
          conditions: { [key]: cond },
        };
      }
      return next;
    });
  };

  const handleRuleMutationChange = (index: number, key: string, val: string) => {
    setTableRules((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          ...next[index]!,
          mutations: { [key]: val },
        };
      }
      return next;
    });
  };

  const handleSave = () => {
    let inputMapping: Record<string, string> = {};
    let outputMapping: Record<string, string> = {};
    try {
      inputMapping = JSON.parse(inputMappingStr);
      outputMapping = JSON.parse(outputMappingStr);
    } catch {
      // fallback
    }

    const updatedCell: CellSchema = {
      id: cell?.id ?? `cell_${row.id}_${column.id}`,
      rowId: row.id,
      colId: column.id,
      action,
      enabled,
      tableRuleConfig: action === 'table_rule' ? { rules: tableRules } : undefined,
      expressionConfig: action === 'expression' ? { expression, outputVariable } : undefined,
      subWorkflowConfig:
        action === 'trigger_sub_workflow' || action === 'override_sub_workflow'
          ? { inputMapping, outputMapping }
          : undefined,
    };

    onSaveCell(updatedCell);
    onClose();
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col font-sans text-slate-900 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between font-mono">
        <div className="flex items-center space-x-2.5">
          <Sliders className="h-4 w-4 text-emerald-600" />
          <div>
            <h3 className="font-bold text-slate-900 text-xs">Configure Cell Coordinate</h3>
            <p className="text-[10px] text-slate-500">
              Row: &quot;{row.label}&quot; ({row.type.toUpperCase()}) × Col: &quot;{column.label}&quot;
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
        {/* Action Type Selector */}
        <div className="space-y-1.5">
          <label className="font-semibold text-slate-700">Cell Action Type ({row.type} row):</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as CellActionType)}
            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-600"
          >
            {isPlainRow ? (
              <>
                <option value="table_rule">Custom Table Rules (Match Conditions ➔ Mutate)</option>
                <option value="expression">Expression Evaluator (Formula)</option>
                <option value="api_call">API Driver Call</option>
                <option value="event_emitter">Event Emitter</option>
                <option value="passthrough">Passthrough (No-Op)</option>
              </>
            ) : (
              <>
                <option value="trigger_sub_workflow">Trigger Bound Sub-Workflow Matrix</option>
                <option value="override_sub_workflow">Trigger Sub-Workflow with Parameter Overrides</option>
                <option value="skip_sub_workflow">Skip Sub-Workflow for this Step</option>
              </>
            )}
          </select>
        </div>

        {/* Config for Custom Table Rules */}
        {action === 'table_rule' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Table Match Rules:</span>
              <button
                type="button"
                onClick={handleAddRule}
                className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-mono text-[11px] flex items-center space-x-1 cursor-pointer font-bold"
              >
                <Plus className="h-3 w-3" />
                <span>Add Match Rule</span>
              </button>
            </div>

            {tableRules.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-[11px] text-center">
                No rules defined yet. Click &quot;Add Match Rule&quot; to configure.
              </div>
            ) : (
              <div className="space-y-3">
                {tableRules.map((rule, idx) => {
                  const condKey = Object.keys(rule.conditions)[0] || 'creditScore';
                  const condVal = Object.values(rule.conditions)[0] || '>= 700';
                  const mutKey = Object.keys(rule.mutations)[0] || 'status';
                  const mutVal = Object.values(rule.mutations)[0] || 'APPROVED';

                  return (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-slate-600 font-bold border-b border-slate-200 pb-1">
                        <span>Rule #{idx + 1}</span>
                        <button
                          onClick={() => handleRemoveRule(idx)}
                          className="text-rose-600 hover:text-rose-700 p-0.5 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-500 text-[10px]">Condition Key:</label>
                          <input
                            type="text"
                            value={condKey}
                            onChange={(e) => handleRuleConditionChange(idx, e.target.value, condVal)}
                            className="w-full p-1.5 bg-white border border-slate-300 rounded text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 text-[10px]">Operator &amp; Value:</label>
                          <input
                            type="text"
                            value={condVal}
                            onChange={(e) => handleRuleConditionChange(idx, condKey, e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-300 rounded text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                        <div>
                          <label className="text-slate-500 text-[10px]">Mutation Output Key:</label>
                          <input
                            type="text"
                            value={mutKey}
                            onChange={(e) => handleRuleMutationChange(idx, e.target.value, mutVal)}
                            className="w-full p-1.5 bg-white border border-slate-300 rounded text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-slate-500 text-[10px]">Mutated Value:</label>
                          <input
                            type="text"
                            value={mutVal}
                            onChange={(e) => handleRuleMutationChange(idx, mutKey, e.target.value)}
                            className="w-full p-1.5 bg-white border border-slate-300 rounded text-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Config for Expressions */}
        {action === 'expression' && (
          <div className="space-y-3 font-mono text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Expression Formula:</label>
              <input
                type="text"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="e.g. payload.creditScore >= 700 ? 'APPROVED' : 'DECLINED'"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-600 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Output Payload Variable Name:</label>
              <input
                type="text"
                value={outputVariable}
                onChange={(e) => setOutputVariable(e.target.value)}
                placeholder="e.g. approvalStatus"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-emerald-600 font-mono"
              />
            </div>
          </div>
        )}

        {/* Config for Sub-Workflow Rows */}
        {!isPlainRow && (action === 'trigger_sub_workflow' || action === 'override_sub_workflow') && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-900 text-[11px]">
              Sub-Workflow Bound: <span className="font-bold">{row.subWorkflowId || 'wf_notification_sub'}</span>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Input Mappings (JSON):</label>
              <textarea
                rows={3}
                value={inputMappingStr}
                onChange={(e) => setInputMappingStr(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-xs text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Output Mappings (JSON):</label>
              <textarea
                rows={3}
                value={outputMappingStr}
                onChange={(e) => setOutputMappingStr(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-xs text-slate-800"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
        <label className="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-slate-300 bg-white text-emerald-600 accent-emerald-600"
          />
          <span>Cell Enabled</span>
        </label>

        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm cursor-pointer"
        >
          <Save className="h-3.5 w-3.5" />
          <span>Save Cell Config</span>
        </button>
      </div>
    </div>
  );
};
