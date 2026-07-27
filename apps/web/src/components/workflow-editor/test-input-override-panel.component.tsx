import React, { useState } from 'react';
import {
  Sliders,
  FlaskConical,
  Play,
  RefreshCw,
  FileJson,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Database,
  Tag,
} from 'lucide-react';
import { MatrixSchema, WorkflowInputField } from '@/types/matrix.types';
import { MatrixExecutionResult } from '@/services/matrix-evaluator.service';

interface TestInputOverridePanelProps {
  matrix: MatrixSchema;
  inputPayload: Record<string, any>;
  onUpdateInputPayload: (payload: Record<string, any>) => void;
  onRunExecution: (payload: Record<string, any>) => Promise<void>;
  isExecuting: boolean;
  executionResult?: MatrixExecutionResult;
  isOpen: boolean;
  onToggleOpen: () => void;
}

const PRESET_PAYLOADS: Record<string, Record<string, any>> = {
  'Standard Application': {
    applicantScore: 740,
    dti: 0.25,
    annualIncome: 95000,
    requestedAmount: 15000,
    employmentStatus: 'FULL_TIME',
  },
  'High Risk / Low Score': {
    applicantScore: 580,
    dti: 0.48,
    annualIncome: 32000,
    requestedAmount: 25000,
    employmentStatus: 'SELF_EMPLOYED',
  },
  'Minimal Empty Input': {},
};

export const TestInputOverridePanel: React.FC<TestInputOverridePanelProps> = ({
  matrix,
  inputPayload,
  onUpdateInputPayload,
  onRunExecution,
  isExecuting,
  executionResult,
  isOpen,
  onToggleOpen,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('Standard Application');
  const [isJsonMode, setIsJsonMode] = useState<boolean>(false);
  const [jsonText, setJsonText] = useState<string>(JSON.stringify(inputPayload, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const workflowInputs = matrix.inputs || [];

  // Handle Preset Select
  const handleSelectPreset = (presetName: string) => {
    setSelectedPreset(presetName);
    const payload = PRESET_PAYLOADS[presetName] || {};
    onUpdateInputPayload(payload);
    setJsonText(JSON.stringify(payload, null, 2));
    setJsonError(null);
  };

  // Field change handler for structured inputs
  const handleFieldChange = (key: string, value: any) => {
    const updated = { ...inputPayload, [key]: value };
    onUpdateInputPayload(updated);
    setJsonText(JSON.stringify(updated, null, 2));
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

  if (!isOpen) {
    return (
      <div className="relative shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col items-center py-4 px-2 space-y-4 shadow-lg select-none">
        <button
          onClick={onToggleOpen}
          className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md cursor-pointer flex items-center justify-center group"
          title="Expand Test & Debug Input Overrides Panel"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        </button>

        <div className="writing-mode-vertical text-[11px] font-mono font-bold tracking-widest text-slate-400 uppercase flex items-center space-x-2 pt-4">
          <FlaskConical className="h-4 w-4 text-emerald-400 rotate-90" />
          <span>Input Overrides</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-lg select-none font-sans text-xs overflow-hidden">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center space-x-2">
          <div className="h-7 w-7 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 flex items-center justify-center font-bold">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-xs flex items-center space-x-1.5">
              <span>Test Input Overrides</span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.2 rounded font-mono font-bold">
                LIVE
              </span>
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">Override inputs to test execution</p>
          </div>
        </div>

        <button
          onClick={onToggleOpen}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Collapse Panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Main Form Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-slate-50">
        {/* Preset selector bar */}
        <div className="space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-slate-700 flex items-center space-x-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>TEST PRESETS</span>
            </span>
            <button
              onClick={() => handleSelectPreset('Standard Application')}
              className="text-[10px] text-slate-500 hover:text-slate-800 underline flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {Object.keys(PRESET_PAYLOADS).map((presetKey) => (
              <button
                key={presetKey}
                onClick={() => handleSelectPreset(presetKey)}
                className={`px-3 py-1.5 rounded-lg border text-left font-mono text-xs transition-all cursor-pointer flex items-center justify-between ${
                  selectedPreset === presetKey
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-2xs'
                    : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <span>{presetKey}</span>
                {selectedPreset === presetKey && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Input Format Toggle (Form vs JSON) */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 pt-1 font-mono text-[11px]">
          <span className="font-bold text-slate-700 flex items-center space-x-1">
            <Database className="h-3.5 w-3.5 text-sky-600" />
            <span>INPUT FIELDS</span>
          </span>

          <div className="flex items-center bg-slate-200 p-0.5 rounded-md text-[10px] font-bold">
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

        {!isJsonMode ? (
          /* Form Input Controls */
          <div className="space-y-3">
            {workflowInputs.length > 0 ? (
              workflowInputs.map((field: WorkflowInputField) => {
                const currentVal = inputPayload[field.key] ?? (field.defaultValue !== undefined ? field.defaultValue : '');

                return (
                  <div key={field.key} className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 shadow-2xs font-mono">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                        <Tag className="h-3 w-3 text-sky-600" />
                        <span>{field.key}</span>
                      </label>

                      <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-[9px] font-semibold text-slate-500">
                        {field.type}
                      </span>
                    </div>

                    {field.type === 'boolean' ? (
                      <div className="flex items-center space-x-3 pt-1">
                        <button
                          type="button"
                          onClick={() => handleFieldChange(field.key, true)}
                          className={`flex-1 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
                            currentVal === true
                              ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          TRUE
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFieldChange(field.key, false)}
                          className={`flex-1 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
                            currentVal === false
                              ? 'bg-rose-100 border-rose-400 text-rose-900'
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
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs bg-slate-50 focus:bg-white text-slate-900 font-mono font-semibold"
                      />
                    ) : (
                      <input
                        type="text"
                        value={currentVal !== undefined ? currentVal : ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs bg-slate-50 focus:bg-white text-slate-900 font-mono font-semibold"
                      />
                    )}
                  </div>
                );
              })
            ) : (
              /* Fallback list if workflow inputs not explicitly defined in schema */
              <div className="space-y-3">
                {Object.keys(inputPayload).map((key) => {
                  const val = inputPayload[key];
                  const valType = typeof val;

                  return (
                    <div key={key} className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 shadow-2xs font-mono">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                          <Tag className="h-3 w-3 text-sky-600" />
                          <span>{key}</span>
                        </label>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-[9px] font-semibold text-slate-500">
                          {valType}
                        </span>
                      </div>

                      {valType === 'boolean' ? (
                        <div className="flex items-center space-x-3 pt-1">
                          <button
                            type="button"
                            onClick={() => handleFieldChange(key, true)}
                            className={`flex-1 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
                              val === true
                                ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            TRUE
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFieldChange(key, false)}
                            className={`flex-1 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
                              val === false
                                ? 'bg-rose-100 border-rose-400 text-rose-900'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            FALSE
                          </button>
                        </div>
                      ) : valType === 'number' ? (
                        <input
                          type="number"
                          value={val !== undefined ? val : ''}
                          onChange={(e) => handleFieldChange(key, e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs bg-slate-50 focus:bg-white text-slate-900 font-mono font-semibold"
                        />
                      ) : (
                        <input
                          type="text"
                          value={val !== undefined ? val : ''}
                          onChange={(e) => handleFieldChange(key, e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs bg-slate-50 focus:bg-white text-slate-900 font-mono font-semibold"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* JSON Raw Text Area */
          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500">RAW JSON PAYLOAD:</span>
              <FileJson className="h-3.5 w-3.5 text-slate-400" />
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

      {/* Footer Action Bar */}
      <div className="p-3.5 border-t border-slate-200 bg-white shrink-0">
        <button
          onClick={handleRun}
          disabled={isExecuting || !!jsonError}
          className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
        >
          {isExecuting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
          <span>{isExecuting ? 'Executing Simulation...' : 'Run Test Simulation'}</span>
        </button>
      </div>
    </div>
  );
};
