import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Layers,
  Edit3,
  Plus,
  PlusCircle,
  Play,
  ShieldCheck,
  FileJson,
  FlaskConical,
  Grid,
  Zap,
  Sliders,
  X,
  Trash2,
  ArrowRight,
  Database,
  Tag,
  CheckCircle2,
  Search,
  FileSpreadsheet,
  FileText,
  Upload,
  RefreshCw,
  GitBranch,
} from 'lucide-react';
import {
  MatrixSchema,
  DomainRowSchema,
  StepColumnSchema,
  CellSchema,
  RowType,
  WorkflowInputField,
  InputValueType,
} from '@/types/matrix.types';

export type WorkflowStudioTab = 'design' | 'test';

interface SpreadsheetToolbarProps {
  activeTab: WorkflowStudioTab;
  onTabChange: (tab: WorkflowStudioTab) => void;
  matrix: MatrixSchema;
  selectedRow?: DomainRowSchema;
  selectedCol?: StepColumnSchema;
  selectedCell?: CellSchema;
  onUpdateName: (name: string) => void;
  onUpdateDescription: (description: string) => void;
  onAddColumn: () => void;
  onAddRow: (type: RowType) => void;
  onRunExecution: () => void;
  isExecuting?: boolean;
  onBackToDashboard: () => void;
  onOpenValidation: () => void;
  onExportJson: () => void;
  onUpdateInputs?: (inputs: WorkflowInputField[]) => void;
  onToggleTestInputsModal?: () => void;
  isTestInputsModalOpen?: boolean;
  showFlows?: boolean;
  onToggleFlows?: () => void;
}

export const SpreadsheetToolbar: React.FC<SpreadsheetToolbarProps> = ({
  activeTab,
  onTabChange,
  matrix,
  selectedRow,
  selectedCol,
  selectedCell,
  onUpdateName,
  onUpdateDescription,
  onAddColumn,
  onAddRow,
  onRunExecution,
  isExecuting = false,
  onBackToDashboard,
  onOpenValidation,
  onExportJson,
  onUpdateInputs,
  onToggleTestInputsModal,
  isTestInputsModalOpen = true,
  showFlows = true,
  onToggleFlows,
}) => {
  const [isInputsModalOpen, setIsInputsModalOpen] = useState(false);
  const [isOutputsModalOpen, setIsOutputsModalOpen] = useState(false);

  // Modal Filter & JSON Paste Mode
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [isPasteJsonMode, setIsPasteJsonMode] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Form State for Adding Single Input
  const [newKey, setNewKey] = useState('');
  const [newType, setNewType] = useState<InputValueType>('string');
  const [newDefaultVal, setNewDefaultVal] = useState('');

  const inputs = matrix.inputs || [];

  // Filtered inputs for search inside modal
  const filteredInputs = useMemo(() => {
    if (!modalSearchQuery.trim()) return inputs;
    const query = modalSearchQuery.toLowerCase();
    return inputs.filter(
      (inp) => inp.key.toLowerCase().includes(query) || inp.type.toLowerCase().includes(query)
    );
  }, [inputs, modalSearchQuery]);

  // Extract read-only decision outputs derived from grid cells
  const derivedOutputs = useMemo(() => {
    const outputsSet = new Map<string, { type: string; source: string }>();

    Object.values(matrix.cells).forEach((cell) => {
      if (!cell || !cell.enabled) return;

      const rowLabel = matrix.rows.find((r) => r.id === cell.rowId)?.label || cell.rowId;
      const colLabel = matrix.columns.find((c) => c.id === cell.colId)?.label || cell.colId;
      const locationLabel = `${rowLabel} [${colLabel}]`;

      // From table_rule cell mutations
      if (cell.action === 'table_rule' && cell.tableRuleConfig?.rules) {
        cell.tableRuleConfig.rules.forEach((rule) => {
          if (rule.mutations) {
            Object.entries(rule.mutations).forEach(([mKey, mVal]) => {
              const valType = typeof mVal;
              outputsSet.set(mKey, {
                type: valType === 'boolean' ? 'boolean' : valType === 'number' ? 'number' : 'string',
                source: `Rule Mutation in ${locationLabel}`,
              });
            });
          }
        });
      }

      // From expression outputs
      if (cell.action === 'expression' && cell.expressionConfig?.outputVariable) {
        outputsSet.set(cell.expressionConfig.outputVariable, {
          type: 'string',
          source: `Expression: ${cell.expressionConfig.outputVariable} in ${locationLabel}`,
        });
      }

      // From sub-workflow output mappings
      if (cell.action === 'trigger_sub_workflow' && cell.subWorkflowConfig?.outputMapping) {
        Object.values(cell.subWorkflowConfig.outputMapping).forEach((targetKey) => {
          outputsSet.set(targetKey, {
            type: 'object',
            source: `Sub-Workflow Return in ${locationLabel}`,
          });
        });
      }
    });

    // Also include explicit matrix.outputSchema if defined
    if (matrix.outputSchema) {
      matrix.outputSchema.forEach((out) => {
        outputsSet.set(out.key, {
          type: out.type,
          source: out.description || 'Explicit Output Schema',
        });
      });
    }

    return Array.from(outputsSet.entries()).map(([key, info]) => ({ key, ...info }));
  }, [matrix.cells, matrix.rows, matrix.columns, matrix.outputSchema]);

  // Add Single Parameter
  const handleAddInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) return;

    const formattedKey = newKey.trim().replace(/\s+/g, '_');
    if (inputs.some((i) => i.key === formattedKey)) return;

    let parsedDefault: any = newDefaultVal;
    if (newType === 'number') parsedDefault = Number(newDefaultVal) || 0;
    if (newType === 'boolean') parsedDefault = newDefaultVal === 'true';

    const newInput: WorkflowInputField = {
      id: `inp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      key: formattedKey,
      type: newType,
      required: true,
      defaultValue: parsedDefault,
    };

    const updated = [...inputs, newInput];
    if (onUpdateInputs) onUpdateInputs(updated);

    setNewKey('');
    setNewType('string');
    setNewDefaultVal('');
  };

  // Inline Edit Key Name or Type
  const handleUpdateItem = (id: string, updates: Partial<WorkflowInputField>) => {
    const updated = inputs.map((item) => (item.id === id ? { ...item, ...updates } : item));
    if (onUpdateInputs) onUpdateInputs(updated);
  };

  const handleRemoveInput = (id: string) => {
    const updated = inputs.filter((i) => i.id !== id);
    if (onUpdateInputs) onUpdateInputs(updated);
  };

  const handleClearAllInputs = () => {
    if (confirm('Clear all input parameters?')) {
      if (onUpdateInputs) onUpdateInputs([]);
    }
  };

  // Parse Bulk JSON Import
  const handleImportJsonPayload = () => {
    setJsonError('');
    try {
      const parsed = JSON.parse(rawJsonText);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setJsonError('JSON must be an object with key-value pairs (e.g. {"creditScore": 720})');
        return;
      }

      const newInputsList: WorkflowInputField[] = Object.entries(parsed).map(([key, val]) => {
        const valType: InputValueType =
          typeof val === 'number'
            ? 'number'
            : typeof val === 'boolean'
            ? 'boolean'
            : Array.isArray(val)
            ? 'array'
            : typeof val === 'object'
            ? 'object'
            : 'string';

        return {
          id: `inp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          key,
          type: valType,
          required: true,
          defaultValue: val,
        };
      });

      // Merge with existing avoiding duplicates
      const mergedMap = new Map<string, WorkflowInputField>();
      inputs.forEach((i) => mergedMap.set(i.key, i));
      newInputsList.forEach((i) => mergedMap.set(i.key, i));

      const updated = Array.from(mergedMap.values());
      if (onUpdateInputs) onUpdateInputs(updated);

      setRawJsonText('');
      setIsPasteJsonMode(false);
    } catch (err: any) {
      setJsonError(`Invalid JSON syntax: ${err.message}`);
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 font-sans text-xs shrink-0 select-none w-full">
      {/* 1. Flush Edge-to-Edge Header Bar */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-slate-100 flex-wrap gap-2">
        {/* Left: Back button, Logo, and Inline Editable Title/Description */}
        <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
          <button
            onClick={onBackToDashboard}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div onClick={onBackToDashboard} className="flex items-center space-x-2 cursor-pointer group shrink-0">
            <img src="/logo.png" alt="Turble Logo" className="h-7 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform" />
            <span className="font-bold text-slate-900 tracking-tight text-sm hidden sm:inline">Turble</span>
          </div>

          <div className="h-4 w-px bg-slate-200 shrink-0" />

          {/* Editable Title & Subtitle */}
          <div className="flex-1 space-y-0.5 max-w-xs min-w-0">
            <div className="flex items-center space-x-2 group min-w-0">
              <input
                type="text"
                value={matrix.name}
                onChange={(e) => onUpdateName(e.target.value)}
                placeholder="Workflow Matrix Name"
                className="font-bold text-slate-900 text-xs tracking-tight bg-transparent hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1.5 py-0.5 w-full transition-all truncate"
              />
              <Edit3 className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
            </div>

            <input
              type="text"
              value={matrix.description}
              onChange={(e) => onUpdateDescription(e.target.value)}
              placeholder="Add description..."
              className="text-slate-500 text-[10px] font-mono bg-transparent hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1.5 py-0.5 w-full transition-all truncate"
            />
          </div>
        </div>

        {/* Center: Tab Control Segment */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 font-mono shrink-0">
          <button
            onClick={() => onTabChange('design')}
            className={`px-3.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'design'
                ? 'bg-white text-slate-900 border border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Design</span>
          </button>

          <button
            onClick={() => onTabChange('test')}
            className={`px-3.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'test'
                ? 'bg-white text-slate-900 border border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Test</span>
          </button>
        </div>

        {/* Right: Global Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onExportJson}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-mono text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Export JSON Schema"
          >
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 2. Flush Edge-to-Edge Sub-Bar (Clean Compact Workflow Tools) */}
      <div className="px-4 py-1.5 bg-slate-50/80 min-h-[38px] flex items-center justify-between font-mono gap-3">
        {activeTab === 'design' ? (
          <div className="flex items-center justify-between w-full space-x-3">
            {/* Cluster 1: Structure Controls (+ Add: Row | Sub-WF | Step) */}
            <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs shrink-0 font-mono text-[11px]">
              <div className="flex items-center space-x-1 px-2 py-0.5 text-slate-500 font-bold select-none">
                <Plus className="h-3.5 w-3.5 text-slate-600" />
                <span>Add</span>
              </div>
              <div className="h-3.5 w-px bg-slate-200 shrink-0" />
              <button
                onClick={() => onAddRow('standard')}
                className="px-2.5 py-0.5 rounded hover:bg-slate-100 text-slate-700 font-semibold transition-colors cursor-pointer"
                title="Add Standard Row"
              >
                Row
              </button>
              <button
                onClick={() => onAddRow('workflow')}
                className="px-2.5 py-0.5 rounded hover:bg-slate-100 text-slate-700 font-semibold transition-colors cursor-pointer"
                title="Add Sub-Workflow Row"
              >
                Sub-WF
              </button>
              <button
                onClick={onAddColumn}
                className="px-2.5 py-0.5 rounded hover:bg-slate-100 text-slate-700 font-semibold transition-colors cursor-pointer"
                title="Add Step Column"
              >
                Step
              </button>
            </div>

            <div className="h-4 w-px bg-slate-300 shrink-0" />

            {/* Cluster 2: Workflow Inputs Summary Button */}
            <button
              data-workflow-inputs-button="true"
              onClick={() => setIsInputsModalOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer text-[11px] font-mono shadow-2xs shrink-0"
              title="Manage Workflow Input Parameters"
            >
              <span className="font-semibold">Inputs</span>
              <span className="text-[10px] text-slate-500 tabular-nums">{inputs.length}</span>
            </button>

            <div className="h-4 w-px bg-slate-300 shrink-0" />

            {/* Cluster 3: Workflow Outputs Summary Button (Read-only) */}
            <button
              onClick={() => setIsOutputsModalOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer text-[11px] font-mono shadow-2xs shrink-0"
              title="View Derived Decision Outputs"
            >
              <span className="font-semibold">Outputs</span>
              <span className="text-[10px] text-slate-500 tabular-nums">{derivedOutputs.length}</span>
            </button>

            <div className="h-4 w-px bg-slate-300 shrink-0" />

            {/* Cluster 4: Show/Hide Dependency Flows Toggle */}
            <button
              onClick={onToggleFlows}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold border transition-all cursor-pointer shadow-2xs shrink-0 ${
                showFlows
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title={showFlows ? 'Hide dependency flow lines' : 'Show dependency flow lines'}
            >
              <span>Flows</span>
            </button>

            <div className="flex-1 min-w-0" />

            {/* Cluster 4: Grid stats */}
            <span className="bg-slate-200/70 text-slate-600 font-bold text-[10px] px-2.5 py-1 rounded shrink-0">
              {matrix.rows.length} Rows × {matrix.columns.length} Cols
            </span>
          </div>
        ) : (
          /* Test Mode Sub-bar */
          <div className="flex items-center justify-between w-full space-x-3">
            <div className="flex items-center space-x-2 shrink-0">
              {onToggleTestInputsModal && (
                <button
                  onClick={onToggleTestInputsModal}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] border transition-all cursor-pointer shadow-2xs shrink-0 ${
                    isTestInputsModalOpen
                      ? 'bg-slate-200/80 text-slate-900 border-slate-300 font-bold'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 font-semibold'
                  }`}
                  title="Toggle Draggable Test Inputs Window"
                >
                  <span>Test Inputs</span>
                  <span className="text-[10px] text-slate-500 tabular-nums">{inputs.length}</span>
                </button>
              )}
            </div>

            <div className="h-4 w-px bg-slate-300 shrink-0" />

            {/* Cluster 2: Workflow Inputs Button */}
            <button
              data-workflow-inputs-button="true"
              onClick={() => setIsInputsModalOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer text-[11px] font-mono shadow-2xs shrink-0"
              title="View Workflow Input Definitions"
            >
              <span className="font-semibold">Inputs</span>
              <span className="text-[10px] text-slate-500 tabular-nums">{inputs.length}</span>
            </button>

            <div className="h-4 w-px bg-slate-300 shrink-0" />

            {/* Cluster 3: Outputs Summary Button */}
            <button
              onClick={() => setIsOutputsModalOpen(true)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer text-[11px] font-mono shadow-2xs shrink-0"
              title="View Derived Decision Outputs"
            >
              <span className="font-semibold">Outputs</span>
              <span className="text-[10px] text-slate-500 tabular-nums">{derivedOutputs.length}</span>
            </button>

            <div className="h-4 w-px bg-slate-300 shrink-0" />

            {/* Cluster 4: Show/Hide Dependency Flows Toggle */}
            <button
              onClick={onToggleFlows}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold border transition-all cursor-pointer shadow-2xs shrink-0 ${
                showFlows
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title={showFlows ? 'Hide dependency flow lines' : 'Show dependency flow lines'}
            >
              <span>Flows</span>
            </button>

            <div className="flex-1 min-w-0" />
          </div>
        )}
      </div>

      {/* 1. High-Density Enterprise Input Schema Setup Modal */}
      {isInputsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden font-sans flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-slate-900 text-sm">Workflow Input Schema</h3>
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border border-slate-200">
                      {inputs.length} Total Parameters
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    Incoming payload keys passed to createWorkflow(id, values=[...])
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsPasteJsonMode(!isPasteJsonMode)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
                    isPasteJsonMode
                      ? 'bg-slate-800 text-white border-slate-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{isPasteJsonMode ? 'Back to Form' : 'Paste JSON'}</span>
                </button>

                <button
                  onClick={() => setIsInputsModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Main Body */}
            <div className="p-5 space-y-4 flex-1 overflow-y-auto min-h-0 font-sans">
              {isPasteJsonMode ? (
                /* Bulk JSON Extraction Mode */
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-800 font-mono flex items-center space-x-1.5">
                      <Upload className="h-4 w-4 text-slate-500" />
                      <span>Paste JSON Payload to Auto-Extract All Input Parameters</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">Accepts JSON Objects</span>
                  </div>

                  <textarea
                    rows={8}
                    value={rawJsonText}
                    onChange={(e) => setRawJsonText(e.target.value)}
                    placeholder={`{\n  "creditScore": 720,\n  "age": 28,\n  "applicantEmail": "user@example.com",\n  "income": 85000\n}`}
                    className="w-full bg-white border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  />

                  {jsonError && <p className="text-xs font-mono text-red-600 font-bold">{jsonError}</p>}

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => setIsPasteJsonMode(false)}
                      className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImportJsonPayload}
                      disabled={!rawJsonText.trim()}
                      className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs disabled:opacity-50"
                    >
                      Parse & Import Parameters
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard Data Table & Form Mode */
                <>
                  {/* Quick Add Form */}
                  <form onSubmit={handleAddInput} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Plus className="h-4 w-4 text-slate-500" />
                        <span>Add Parameter</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 font-normal">Fast Single Entry</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={newKey}
                          onChange={(e) => setNewKey(e.target.value)}
                          placeholder="KEY Name (e.g. creditScore)"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                        />
                      </div>
                      <div>
                        <select
                          value={newType}
                          onChange={(e) => setNewType(e.target.value as InputValueType)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                          <option value="object">object</option>
                          <option value="array">array</option>
                        </select>
                      </div>
                      <div>
                        <button
                          type="submit"
                          disabled={!newKey.trim()}
                          className="w-full py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Filter & Batch Actions Bar */}
                  <div className="flex items-center justify-between gap-3 font-mono">
                    <div className="relative flex-1">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={modalSearchQuery}
                        onChange={(e) => setModalSearchQuery(e.target.value)}
                        placeholder="Search parameter keys or types..."
                        className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[11px] text-slate-500 font-bold">
                        {filteredInputs.length} of {inputs.length} Items
                      </span>
                      {inputs.length > 0 && (
                        <button
                          onClick={handleClearAllInputs}
                          className="px-2 py-1 rounded text-red-600 hover:bg-red-50 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  </div>

                  {/* High-Density Spreadsheet Table View */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                    <div className="max-h-[320px] overflow-y-auto">
                      <table className="w-full border-collapse text-left text-xs font-mono">
                        <thead className="bg-slate-100/90 text-slate-600 sticky top-0 z-10 border-b border-slate-200 text-[10px] uppercase font-bold tracking-wider">
                          <tr>
                            <th className="py-2 px-3 w-10 text-center">#</th>
                            <th className="py-2 px-3">Parameter KEY Name</th>
                            <th className="py-2 px-3 w-36">Value Type</th>
                            <th className="py-2 px-3 w-40">Default Value</th>
                            <th className="py-2 px-3 w-14 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {filteredInputs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400 text-xs italic">
                                {modalSearchQuery ? 'No matching parameters found.' : 'No input parameters defined yet.'}
                              </td>
                            </tr>
                          ) : (
                            filteredInputs.map((inp, idx) => (
                              <tr key={inp.id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="py-1.5 px-3 text-center text-slate-400 text-[11px]">{idx + 1}</td>

                                {/* KEY Name (Inline Editable) */}
                                <td className="py-1.5 px-3">
                                  <input
                                    type="text"
                                    value={inp.key}
                                    onChange={(e) => handleUpdateItem(inp.id, { key: e.target.value })}
                                    className="w-full font-bold text-xs text-slate-900 bg-transparent hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 rounded px-1.5 py-0.5 transition-all"
                                  />
                                </td>

                                {/* Value Type Dropdown */}
                                <td className="py-1.5 px-3">
                                  <select
                                    value={inp.type}
                                    onChange={(e) => handleUpdateItem(inp.id, { type: e.target.value as InputValueType })}
                                    className="w-full bg-slate-50 text-slate-800 font-semibold border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                                  >
                                    <option value="string">string</option>
                                    <option value="number">number</option>
                                    <option value="boolean">boolean</option>
                                    <option value="object">object</option>
                                    <option value="array">array</option>
                                  </select>
                                </td>

                                {/* Default Value */}
                                <td className="py-1.5 px-3">
                                  <input
                                    type="text"
                                    value={inp.defaultValue !== undefined ? String(inp.defaultValue) : ''}
                                    onChange={(e) => handleUpdateItem(inp.id, { defaultValue: e.target.value })}
                                    placeholder="None"
                                    className="w-full text-slate-600 text-xs bg-transparent hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 rounded px-1.5 py-0.5 transition-all"
                                  />
                                </td>

                                {/* Actions */}
                                <td className="py-1.5 px-3 text-center">
                                  <button
                                    onClick={() => handleRemoveInput(inp.id)}
                                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    title="Delete parameter"
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
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 font-mono">
              <span className="text-xs text-slate-500">
                {inputs.length} parameters ready for workflow execution
              </span>

              <button
                onClick={() => setIsInputsModalOpen(false)}
                className="px-5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs cursor-pointer"
              >
                Done & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Workflow Decision Outputs Inspector Modal (Read-only) */}
      {isOutputsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden font-sans flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-slate-900 text-sm">Derived Decision Outputs (Read-Only)</h3>
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border border-slate-200">
                      {derivedOutputs.length} Output Fields
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    Output decision fields produced by grid cell rules & expressions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOutputsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto min-h-0 font-sans">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs font-mono">
                    <thead className="bg-slate-100/90 text-slate-600 sticky top-0 z-10 border-b border-slate-200 text-[10px] uppercase font-bold tracking-wider">
                      <tr>
                        <th className="py-2 px-3 w-10 text-center">#</th>
                        <th className="py-2 px-3">Output Field Key</th>
                        <th className="py-2 px-3 w-36">Data Type</th>
                        <th className="py-2 px-3">Source Execution Cell</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {derivedOutputs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400 text-xs italic">
                            No output mutations or expressions defined in grid cells yet.
                          </td>
                        </tr>
                      ) : (
                        derivedOutputs.map(({ key, type, source }, idx) => (
                          <tr key={key} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 text-center text-slate-400 text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-xs text-slate-900">{key}</td>
                            <td className="py-2 px-3">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                                {type}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-500 text-[11px]">{source}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0 font-mono">
              <button
                onClick={() => setIsOutputsModalOpen(false)}
                className="px-5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
