import React, { useState } from 'react';
import { Plus, Trash2, ArrowRightLeft, FileCode, CheckCircle2 } from 'lucide-react';
import { MatrixSchema } from '@/types/matrix.types';

interface IoSchemaSetupProps {
  matrix: MatrixSchema;
  onUpdateMatrix: (updated: MatrixSchema) => void;
}

interface VariableField {
  key: string;
  type: 'number' | 'string' | 'boolean' | 'object';
  required: boolean;
  description: string;
}

export const IoSchemaSetup: React.FC<IoSchemaSetupProps> = ({ matrix, onUpdateMatrix }) => {
  // Sample initial schema state derived from matrix or defaults
  const [inputs, setInputs] = useState<VariableField[]>([
    { key: 'applicantScore', type: 'number', required: true, description: 'Bureau credit risk score (300-850)' },
    { key: 'dti', type: 'number', required: true, description: 'Debt-to-income ratio (0.00 - 1.00)' },
    { key: 'annualIncome', type: 'number', required: false, description: 'Verified gross annual income' },
  ]);

  const [outputs, setOutputs] = useState<VariableField[]>([
    { key: 'riskResult', type: 'string', required: true, description: 'Decision tier (PASS, REFER, REJECT)' },
    { key: 'maxLimit', type: 'number', required: false, description: 'Calculated credit line limit' },
    { key: 'isAuthorized', type: 'boolean', required: true, description: 'Interceptor security authorization flag' },
  ]);

  const handleAddInput = () => {
    const key = `var_${Date.now().toString().slice(-4)}`;
    setInputs((prev) => [...prev, { key, type: 'string', required: false, description: 'New input parameter' }]);
  };

  const handleRemoveInput = (index: number) => {
    setInputs((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddOutput = () => {
    const key = `out_${Date.now().toString().slice(-4)}`;
    setOutputs((prev) => [...prev, { key, type: 'string', required: true, description: 'Output result field' }]);
  };

  const handleRemoveOutput = (index: number) => {
    setOutputs((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className="flex-1 w-full h-full bg-slate-100 font-sans text-xs overflow-y-auto p-6 space-y-6 select-none">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold shrink-0">
            <ArrowRightLeft className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-bold text-slate-900 text-sm">Workflow Input & Output (I/O) Schema Setup</h2>
            <p className="text-slate-500 font-mono text-xs mt-0.5">
              Define expected incoming payload variables and returned output decision schema for <span className="font-bold text-slate-800">{matrix.name}</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 font-mono text-xs">
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2.5 py-1 rounded-md shadow-2xs flex items-center space-x-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Schema Synchronized</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Input Variables Setup */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <FileCode className="h-4 w-4 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-xs">1. INCOMING PAYLOAD VARIABLES (INPUTS)</h3>
            </div>

            <button
              onClick={handleAddInput}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Input Parameter</span>
            </button>
          </div>

          <div className="space-y-2.5 font-mono">
            {inputs.map((inp, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between space-x-2">
                  <input
                    type="text"
                    value={inp.key}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInputs((prev) => prev.map((item, i) => (i === idx ? { ...item, key: val } : item)));
                    }}
                    placeholder="variableName"
                    className="font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-600 flex-1 font-mono"
                  />

                  <select
                    value={inp.type}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setInputs((prev) => prev.map((item, i) => (i === idx ? { ...item, type: val } : item)));
                    }}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-semibold text-slate-700"
                  >
                    <option value="number">number</option>
                    <option value="string">string</option>
                    <option value="boolean">boolean</option>
                    <option value="object">object</option>
                  </select>

                  <button
                    onClick={() => handleRemoveInput(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer rounded hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <input
                  type="text"
                  value={inp.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInputs((prev) => prev.map((item, i) => (i === idx ? { ...item, description: val } : item)));
                  }}
                  placeholder="Field description..."
                  className="w-full text-[11px] text-slate-500 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-600"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Output Decision Schema Setup */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <FileCode className="h-4 w-4 text-purple-600" />
              <h3 className="font-bold text-slate-900 text-xs">2. RETURNED DECISION PAYLOAD (OUTPUTS)</h3>
            </div>

            <button
              onClick={handleAddOutput}
              className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-mono text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Output Field</span>
            </button>
          </div>

          <div className="space-y-2.5 font-mono">
            {outputs.map((out, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between space-x-2">
                  <input
                    type="text"
                    value={out.key}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOutputs((prev) => prev.map((item, i) => (i === idx ? { ...item, key: val } : item)));
                    }}
                    placeholder="outputKey"
                    className="font-bold text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-purple-600 flex-1 font-mono"
                  />

                  <select
                    value={out.type}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setOutputs((prev) => prev.map((item, i) => (i === idx ? { ...item, type: val } : item)));
                    }}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-semibold text-slate-700"
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="object">object</option>
                  </select>

                  <button
                    onClick={() => handleRemoveOutput(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer rounded hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <input
                  type="text"
                  value={out.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOutputs((prev) => prev.map((item, i) => (i === idx ? { ...item, description: val } : item)));
                  }}
                  placeholder="Output field description..."
                  className="w-full text-[11px] text-slate-500 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-purple-600"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
