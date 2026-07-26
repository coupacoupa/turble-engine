import React, { useState } from 'react';
import { Play, FlaskConical, Clock, CheckCircle2, FileJson, RefreshCw } from 'lucide-react';
import { MatrixSchema } from '@/types/matrix.types';
import { MatrixExecutionResult } from '@/services/matrix-evaluator.service';
import { TimeTravelBar } from '@/components/debugger/time-travel-bar.component';

interface TestLabProps {
  matrix: MatrixSchema;
  onRunExecution: (inputPayload: Record<string, any>) => Promise<void>;
  isExecuting: boolean;
  executionResult?: MatrixExecutionResult;
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

export const TestLab: React.FC<TestLabProps> = ({
  matrix,
  onRunExecution,
  isExecuting,
  executionResult,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('Standard Application');
  const [jsonInputText, setJsonInputText] = useState<string>(
    JSON.stringify(PRESET_PAYLOADS['Standard Application'], null, 2),
  );
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const handlePresetSelect = (presetName: string) => {
    setSelectedPreset(presetName);
    const payload = PRESET_PAYLOADS[presetName];
    setJsonInputText(JSON.stringify(payload, null, 2));
    setJsonParseError(null);
  };

  const handleTextChange = (text: string) => {
    setJsonInputText(text);
    try {
      JSON.parse(text);
      setJsonParseError(null);
    } catch (err: any) {
      setJsonParseError(err.message || 'Invalid JSON syntax');
    }
  };

  const handleRun = () => {
    try {
      const parsed = JSON.parse(jsonInputText);
      setJsonParseError(null);
      onRunExecution(parsed);
      setCurrentStepIndex(0);
    } catch (err: any) {
      setJsonParseError(err.message || 'Cannot parse JSON input');
    }
  };

  const stepSnapshot = (() => {
    const log = executionResult?.eventLog;
    if (!log?.stepRecords?.length) return undefined;
    const safeIndex = Math.min(Math.max(0, currentStepIndex), log.stepRecords.length - 1);
    const stepRecord = log.stepRecords[safeIndex];
    return { currentPayload: stepRecord.finalPayload, activeStepRecord: stepRecord };
  })();

  const totalDurationMs = (() => {
    const log = executionResult?.eventLog;
    if (log?.startedAt && log?.completedAt) {
      return log.completedAt - log.startedAt;
    }
    return 12;
  })();

  return (
    <div className="flex-1 w-full h-full flex flex-col lg:flex-row bg-slate-100 font-sans text-xs overflow-hidden select-none">
      {/* Left Panel: Test Payload Setup */}
      <div className="w-full lg:w-96 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 shadow-2xs">
        {/* Panel Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FlaskConical className="h-4 w-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Test Payload & Input Data</h3>
          </div>

          <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
            TEST LAB
          </span>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Preset Selector */}
          <div className="space-y-1.5 font-mono">
            <label className="text-slate-500 font-bold text-[11px]">PRESET TEMPLATES:</label>
            <div className="grid grid-cols-1 gap-1.5">
              {Object.keys(PRESET_PAYLOADS).map((presetKey) => (
                <button
                  key={presetKey}
                  onClick={() => handlePresetSelect(presetKey)}
                  className={`px-3 py-2 rounded-lg border text-left font-mono text-xs transition-all cursor-pointer flex items-center justify-between ${
                    selectedPreset === presetKey
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span>{presetKey}</span>
                  {selectedPreset === presetKey && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* JSON Payload Input Editor */}
          <div className="space-y-1.5 font-mono flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-slate-500 font-bold text-[11px]">INPUT PAYLOAD (JSON):</label>
              <FileJson className="h-3.5 w-3.5 text-slate-400" />
            </div>

            <textarea
              value={jsonInputText}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={12}
              className={`w-full p-3 rounded-lg font-mono text-xs bg-slate-900 text-emerald-400 focus:outline-none resize-none shadow-inner leading-relaxed ${
                jsonParseError ? 'border-2 border-rose-500' : 'border border-slate-700'
              }`}
            />

            {jsonParseError && (
              <div className="text-rose-600 font-mono text-[11px] bg-rose-50 p-2 rounded border border-rose-200">
                ⚠️ {jsonParseError}
              </div>
            )}
          </div>
        </div>

        {/* Run Action Button Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleRun}
            disabled={isExecuting || !!jsonParseError}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {isExecuting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            <span>{isExecuting ? 'Executing Matrix Simulation...' : 'Run Test Simulation'}</span>
          </button>
        </div>
      </div>

      {/* Right Panel: Execution Results & Telemetry */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-slate-100 overflow-hidden">
        {executionResult ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Execution Result Header Banner */}
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  ✓
                </div>

                <div>
                  <div className="font-bold text-slate-900 text-sm">Execution Completed Successfully</div>
                  <div className="text-slate-500 font-mono text-xs flex items-center space-x-3 mt-0.5">
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span>Duration: {totalDurationMs}ms</span>
                    </span>
                    <span>•</span>
                    <span>Steps Executed: {executionResult.eventLog?.stepRecords?.length || 0}</span>
                  </div>
                </div>
              </div>

              <div className="font-mono text-xs text-slate-500">
                Matrix: <span className="font-bold text-slate-800">{matrix.name}</span>
              </div>
            </div>

            {/* Output Payload & Telemetry Breakdown */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* Output State Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3 font-mono">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                    <FileJson className="h-4 w-4 text-emerald-600" />
                    <span>FINAL OUTPUT PAYLOAD</span>
                  </span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200">
                    MATCHED STATE
                  </span>
                </div>

                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg text-xs overflow-x-auto shadow-inner leading-relaxed">
                  {JSON.stringify(executionResult.finalPayload, null, 2)}
                </pre>
              </div>

              {/* Execution Step Log Timeline */}
              <div className="space-y-3">
                <div className="font-bold text-slate-700 text-xs font-mono">EXECUTION STEP TRACE</div>

                <div className="space-y-2 font-mono">
                  {executionResult.eventLog?.stepRecords?.map((rec, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border bg-white shadow-2xs transition-all ${
                        currentStepIndex === idx ? 'ring-2 ring-emerald-500 border-emerald-300' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2 font-bold text-slate-900">
                          <span className="h-5 w-5 rounded bg-slate-100 border border-slate-300 flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <span>Step Column: {rec.colLabel || rec.colId}</span>
                        </div>
                      </div>

                      <div className="mt-2 text-[11px] text-slate-600 space-y-1.5">
                        {rec.cellResults?.map((cell, cIdx) => (
                          <div key={cIdx} className="bg-slate-50 p-2 rounded border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-semibold">
                              <span>Cell: [{cell.rowId}:{cell.colId}] ({cell.action})</span>
                              <span className="text-slate-400">{cell.latencyMs}ms</span>
                            </div>
                            {cell.mutatedPayload && Object.keys(cell.mutatedPayload).length > 0 && (
                              <div className="text-emerald-700 font-semibold text-[10px]">
                                Mutated Payload: {JSON.stringify(cell.mutatedPayload)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Time Travel Bar at bottom of Test Lab */}
            <div className="shrink-0">
              <TimeTravelBar
                eventLog={executionResult.eventLog}
                currentStepIndex={currentStepIndex}
                onStepChange={(idx) => setCurrentStepIndex(idx)}
                currentPayload={stepSnapshot?.currentPayload}
              />
            </div>
          </div>
        ) : (
          /* Empty State: Ready to run test */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <FlaskConical className="h-8 w-8 text-emerald-600" />
            </div>

            <div className="space-y-1 max-w-sm">
              <h3 className="font-bold text-slate-900 text-base">Workflow Simulation Lab</h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                Select a preset payload or customize JSON input variables on the left panel, then click{' '}
                <span className="font-bold text-emerald-700">Run Test Simulation</span> to evaluate all step rules.
              </p>
            </div>

            <button
              onClick={handleRun}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-2 shadow-xs transition-colors cursor-pointer"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Run Initial Simulation</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
