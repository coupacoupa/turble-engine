import React, { useState, useMemo } from 'react';
import {
  Play,
  RefreshCw,
  FileJson,
  CheckCircle2,
  RotateCcw,
  Database,
  Tag,
  Search,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { MatrixSchema, WorkflowInputField } from '@/types/matrix.types';
import { MatrixExecutionResult } from '@/services/matrix-evaluator.service';
import { DraggableModal } from '@/components/common/draggable-modal.component';

interface TestInputsModalProps {
  isOpen: boolean;
  onClose: () => void;
  matrix: MatrixSchema;
  inputPayload: Record<string, any>;
  onUpdateInputPayload: (payload: Record<string, any>) => void;
  onRunExecution: (payload: Record<string, any>) => Promise<void>;
  isExecuting: boolean;
  executionResult?: MatrixExecutionResult;
}

const DEFAULT_WIDTH = 620;
const DEFAULT_HEIGHT = 640;
const MIN_WIDTH = 440;
const MIN_HEIGHT = 400;

export const TestInputsModal: React.FC<TestInputsModalProps> = ({
  isOpen,
  onClose,
  matrix,
  inputPayload,
  onUpdateInputPayload,
  onRunExecution,
  isExecuting,
  executionResult,
}) => {
  const [isJsonMode, setIsJsonMode] = useState<boolean>(false);
  const [jsonText, setJsonText] = useState<string>(JSON.stringify(inputPayload, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const workflowInputs = matrix.inputs || [];

  // Derived field list: uses matrix.inputs if defined, or falls back to keys present in inputPayload
  const allFieldKeys = useMemo<WorkflowInputField[]>(() => {
    if (workflowInputs.length > 0) return workflowInputs;
    return Object.keys(inputPayload).map((key) => ({
      id: key,
      key,
      type: (typeof inputPayload[key] === 'boolean' ? 'boolean' : typeof inputPayload[key] === 'number' ? 'number' : 'string') as any,
      required: true,
      defaultValue: inputPayload[key],
    }));
  }, [workflowInputs, inputPayload]);

  // Filtered fields based on search query for mass inputs handling
  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return allFieldKeys;
    const query = searchQuery.toLowerCase().trim();
    return allFieldKeys.filter(
      (field) => field.key.toLowerCase().includes(query) || field.type.toLowerCase().includes(query)
    );
  }, [allFieldKeys, searchQuery]);

  // Single field value updater
  const handleFieldChange = (key: string, value: any) => {
    const updated = { ...inputPayload, [key]: value };
    onUpdateInputPayload(updated);
    setJsonText(JSON.stringify(updated, null, 2));
  };

  // Reset inputs to schema default values or empty strings
  const handleResetToDefaults = () => {
    const resetPayload: Record<string, any> = {};
    allFieldKeys.forEach((field) => {
      resetPayload[field.key] = field.defaultValue !== undefined ? field.defaultValue : '';
    });
    onUpdateInputPayload(resetPayload);
    setJsonText(JSON.stringify(resetPayload, null, 2));
    setJsonError(null);
  };

  // Clear all input values
  const handleClearAll = () => {
    const clearedPayload: Record<string, any> = {};
    allFieldKeys.forEach((field) => {
      clearedPayload[field.key] = '';
    });
    onUpdateInputPayload(clearedPayload);
    setJsonText(JSON.stringify(clearedPayload, null, 2));
    setJsonError(null);
  };

  // JSON raw text handler
  const handleJsonTextChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setJsonError(null);
      onUpdateInputPayload(parsed);
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON syntax');
    }
  };

  // Format / Prettify JSON
  const handlePrettifyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON syntax');
    }
  };

  // Run simulation handler
  const handleRun = () => {
    if (isJsonMode) {
      try {
        const parsed = JSON.parse(jsonText);
        setJsonError(null);
        onRunExecution(parsed);
      } catch (err: any) {
        setJsonError(err.message || 'Cannot parse JSON');
      }
    } else {
      onRunExecution(inputPayload);
    }
  };

  if (!isOpen) return null;

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Test Inputs"
      defaultWidth={DEFAULT_WIDTH}
      defaultHeight={DEFAULT_HEIGHT}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
      footer={
        <button
          onClick={handleRun}
          disabled={isExecuting || !!jsonError}
          className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
        >
          {isExecuting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
          <span>{isExecuting ? 'Executing Simulation...' : 'Run Test Simulation'}</span>
        </button>
      }
    >
      {/* Main Content Body */}
      <div className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-slate-50 text-xs">
        {/* Compact Header Toolbar & Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white p-2.5 border border-slate-200 rounded-xl shadow-2xs font-mono text-[11px]">
          <div className="flex items-center space-x-2">
            <Database className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <span className="font-bold text-slate-800">
              Input Parameters ({allFieldKeys.length})
            </span>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={handleResetToDefaults}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer"
              title="Reset values to schema default settings"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Defaults</span>
            </button>

            <button
              onClick={handleClearAll}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-semibold border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer"
              title="Clear all input fields"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear</span>
            </button>

            <div className="h-3.5 w-px bg-slate-200 mx-0.5" />

            {/* View Mode Toggle (Form vs JSON) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 font-bold text-[10px]">
              <button
                onClick={() => setIsJsonMode(false)}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  !isJsonMode ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Form
              </button>
              <button
                onClick={() => setIsJsonMode(true)}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  isJsonMode ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                JSON
              </button>
            </div>
          </div>
        </div>

        {!isJsonMode ? (
          /* Form Input Controls (Optimized for Mass Inputs) */
          <div className="space-y-2.5">
            {/* Search Filter Input Bar for Mass Inputs */}
            {allFieldKeys.length > 4 && (
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${allFieldKeys.length} input variables...`}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-400 shadow-2xs"
                />
              </div>
            )}

            {filteredFields.length > 0 ? (
              /* Ultra-Compact Mass Input List: Word & Box Side-by-Side on Single Line */
              <div className="space-y-1.5">
                {filteredFields.map((field) => {
                  const currentVal = inputPayload[field.key] ?? (field.defaultValue !== undefined ? field.defaultValue : '');

                  return (
                    <div
                      key={field.key}
                      className="flex items-center justify-between gap-3 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors font-mono text-xs shadow-2xs"
                    >
                      {/* Left: Key Name + Type Badge */}
                      <div className="flex items-center space-x-2 min-w-0 shrink-0 max-w-[45%]">
                        <span className="font-bold text-slate-800 text-[11px] truncate" title={field.key}>
                          {field.key}
                        </span>
                        <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.1 rounded font-semibold shrink-0">
                          {field.type}
                        </span>
                      </div>

                      {/* Right: Inline Input Box */}
                      <div className="flex-1 max-w-[55%] flex justify-end">
                        {field.type === 'boolean' ? (
                          <div className="flex items-center space-x-1 w-full max-w-[120px]">
                            <button
                              type="button"
                              onClick={() => handleFieldChange(field.key, true)}
                              className={`flex-1 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                currentVal === true
                                  ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              TRUE
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFieldChange(field.key, false)}
                              className={`flex-1 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                                currentVal === false
                                  ? 'bg-rose-100 border-rose-400 text-rose-950'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              FALSE
                            </button>
                          </div>
                        ) : field.type === 'number' ? (
                          <input
                            type="number"
                            value={currentVal !== undefined ? currentVal : ''}
                            onChange={(e) =>
                              handleFieldChange(field.key, e.target.value === '' ? '' : Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs bg-slate-50/50 focus:bg-white text-slate-900 font-mono font-semibold text-right"
                          />
                        ) : (
                          <input
                            type="text"
                            value={currentVal !== undefined ? currentVal : ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            className="w-full px-2.5 py-1 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs bg-slate-50/50 focus:bg-white text-slate-900 font-mono font-semibold"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty state if search returns no fields or no fields defined */
              <div className="p-8 bg-white border border-slate-200 rounded-xl text-center font-mono space-y-2">
                <p className="text-slate-500 font-semibold text-xs">
                  {searchQuery ? `No input fields found matching "${searchQuery}"` : 'No workflow inputs defined yet.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-slate-700 underline font-bold cursor-pointer"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* JSON Raw Text Area */
          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-600">RAW JSON PAYLOAD:</span>
              <button
                onClick={handlePrettifyJson}
                className="text-[10px] text-slate-600 hover:text-slate-900 underline flex items-center space-x-1 cursor-pointer"
              >
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span>Prettify JSON</span>
              </button>
            </div>

            <textarea
              value={jsonText}
              onChange={(e) => handleJsonTextChange(e.target.value)}
              rows={12}
              className={`w-full p-3 rounded-lg font-mono text-xs bg-slate-900 text-emerald-400 focus:outline-none resize-none shadow-inner leading-relaxed ${
                jsonError ? 'border-2 border-rose-500' : 'border border-slate-700'
              }`}
            />

            {jsonError && (
              <div className="text-rose-600 font-mono text-[11px] bg-rose-50 p-2 rounded border border-rose-200">
                ⚠️ {jsonError}
              </div>
            )}
          </div>
        )}

        {/* Final Evaluated Outputs Card */}
        {executionResult && (
          <div className="pt-2 border-t border-slate-200 space-y-2 font-mono">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>EVALUATED OUTPUTS</span>
              </span>

              <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-1.5 py-0.2 rounded">
                COMPLETED
              </span>
            </div>

            <div className="bg-slate-900 text-emerald-400 p-3 rounded-lg text-xs space-y-1.5 shadow-inner overflow-x-auto">
              {Object.keys(executionResult.finalPayload || {}).length > 0 ? (
                Object.entries(executionResult.finalPayload).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-[11px] border-b border-slate-800/80 pb-1">
                    <span className="text-slate-400 font-semibold">{k}:</span>
                    <span className="font-bold text-amber-300">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  </div>
                ))
              ) : (
                <span className="text-slate-500 italic text-[10px]">No evaluated outputs generated yet.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </DraggableModal>
  );
};
