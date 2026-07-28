import React, { useState, useMemo } from 'react';
import {
  Search,
  Pin,
  PinOff,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
  Database,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { MatrixSchema, StepEvaluationRecord } from '@/types/matrix.types';
import { MatrixExecutionResult } from '@/services/matrix-evaluator.service';
import { DraggableModal } from '@/components/common/draggable-modal.component';

interface TestExecutionInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  matrix: MatrixSchema;
  executionResult?: MatrixExecutionResult;
  currentStepIndex: number;
  onSelectStepIndex: (index: number) => void;
  onHoverStepRecord: (step?: StepEvaluationRecord) => void;
}

const DEFAULT_WIDTH = 740;
const DEFAULT_HEIGHT = 640;
const MIN_WIDTH = 500;
const MIN_HEIGHT = 420;

export const TestExecutionInspectorModal: React.FC<TestExecutionInspectorModalProps> = ({
  isOpen,
  onClose,
  matrix,
  executionResult,
  currentStepIndex,
  onSelectStepIndex,
  onHoverStepRecord,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pinnedVariableKeys, setPinnedVariableKeys] = useState<Set<string>>(
    new Set(['finalDecision', 'applicantScore'])
  );

  const stepRecords = executionResult?.eventLog?.stepRecords || [];

  // Active step snapshot calculation
  const activeStepRecord = useMemo(() => {
    if (!stepRecords.length) return undefined;
    const safeIdx = Math.min(Math.max(0, currentStepIndex), stepRecords.length - 1);
    return stepRecords[safeIdx];
  }, [stepRecords, currentStepIndex]);

  // Current payload at active step snapshot
  const activePayload = useMemo<Record<string, any>>(() => {
    return activeStepRecord?.finalPayload || executionResult?.finalPayload || {};
  }, [activeStepRecord, executionResult]);

  // All variable entries derived from active payload
  const allVariableEntries = useMemo(() => {
    return Object.entries(activePayload).map(([key, value]) => ({
      key,
      value,
      type: typeof value,
    }));
  }, [activePayload]);

  // Filtered variables based on search query
  const filteredVariables = useMemo(() => {
    if (!searchQuery.trim()) return allVariableEntries;
    const q = searchQuery.toLowerCase().trim();
    return allVariableEntries.filter(
      (item) => item.key.toLowerCase().includes(q) || String(item.value).toLowerCase().includes(q)
    );
  }, [allVariableEntries, searchQuery]);

  // Split into Pinned vs Unpinned variables
  const pinnedVariables = useMemo(() => {
    return filteredVariables.filter((item) => pinnedVariableKeys.has(item.key));
  }, [filteredVariables, pinnedVariableKeys]);

  const unpinnedVariables = useMemo(() => {
    return filteredVariables.filter((item) => !pinnedVariableKeys.has(item.key));
  }, [filteredVariables, pinnedVariableKeys]);

  // Toggle variable pin state
  const handleTogglePin = (key: string) => {
    setPinnedVariableKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (!isOpen || !executionResult) return null;

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Execution Inspector"
      defaultWidth={DEFAULT_WIDTH}
      defaultHeight={DEFAULT_HEIGHT}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
    >
      <div className="flex-1 flex flex-col md:flex-row h-full min-h-0 bg-slate-50 font-sans text-xs overflow-hidden">
        {/* Left Side: Step Trace Timeline (Strict Column-by-Column, Row-by-Row) */}
        <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 min-h-0">
          {/* Header Banner */}
          <div className="p-3 border-b border-slate-200 bg-slate-100/70 flex items-center justify-between font-mono shrink-0">
            <div className="flex items-center space-x-2">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-bold text-slate-800 text-xs">
                Execution Steps ({stepRecords.length})
              </span>
            </div>

            <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-1.5 py-0.2 rounded border border-slate-300">
              Col × Row
            </span>
          </div>

          {/* Step Timeline List */}
          <div className="flex-1 p-2 space-y-1.5 overflow-y-auto min-h-0 font-mono">
            {stepRecords.length === 0 ? (
              <div className="p-6 text-center text-slate-400 font-sans text-xs">
                No execution steps recorded.
              </div>
            ) : (
              stepRecords.map((rec, idx) => {
                const isSelected = currentStepIndex === idx;
                const cellRes = rec.cellResults?.[0];
                const rowObj = matrix.rows.find((r) => r.id === cellRes?.rowId);
                const colObj = matrix.columns.find((c) => c.id === cellRes?.colId);
                const label = `${colObj?.label || rec.colLabel || rec.colId} × ${rowObj?.label || cellRes?.rowId || 'Row'}`;
                const mutationsCount = cellRes?.mutatedPayload ? Object.keys(cellRes.mutatedPayload).length : 0;

                return (
                  <div
                    key={idx}
                    onClick={() => onSelectStepIndex(idx)}
                    onMouseEnter={() => onHoverStepRecord(rec)}
                    onMouseLeave={() => onHoverStepRecord(undefined)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-800 shadow-sm'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 font-bold truncate">
                        <span
                          className={`h-4 w-4 rounded text-[9px] flex items-center justify-center font-mono ${
                            isSelected ? 'bg-emerald-500 text-slate-950 font-extrabold' : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="truncate">{label}</span>
                      </div>

                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[10px] font-sans">
                      <span className={isSelected ? 'text-slate-300' : 'text-slate-500'}>
                        Action: <strong className="font-mono">{cellRes?.action || 'passthrough'}</strong>
                      </span>

                      {mutationsCount > 0 ? (
                        <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold ${
                          isSelected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          +{mutationsCount} var
                        </span>
                      ) : (
                        <span className={isSelected ? 'text-slate-400' : 'text-slate-400'}>Passthrough</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Variable Snapshot Inspector & Pinning */}
        <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 bg-slate-50 overflow-hidden">
          {/* Top Inspector Header */}
          <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 font-mono">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-slate-600" />
              <span className="font-bold text-slate-800 text-xs">
                Variable Snapshot {activeStepRecord ? `(Step #${currentStepIndex + 1})` : ''}
              </span>
            </div>

            <div className="text-[10px] text-slate-500">
              Total Variables: <strong className="text-slate-800">{allVariableEntries.length}</strong>
            </div>
          </div>

          {/* Search Filter Bar */}
          <div className="p-3 border-b border-slate-200 bg-white shrink-0">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search variables by name or value..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-400 shadow-2xs"
              />
            </div>
          </div>

          {/* Variable List Content (Pinned + Unpinned) */}
          <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-0 font-mono">
            {/* Pinned Variables Section */}
            {pinnedVariables.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <Pin className="h-3 w-3 text-amber-500" />
                  <span>PINNED VARIABLES ({pinnedVariables.length})</span>
                </div>

                <div className="space-y-1">
                  {pinnedVariables.map((item) => (
                    <div
                      key={`pinned_${item.key}`}
                      className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between gap-2 shadow-2xs transition-colors hover:bg-amber-50"
                    >
                      <div className="flex items-center space-x-2 min-w-0 max-w-[50%]">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(item.key)}
                          title="Unpin Variable"
                          className="text-amber-600 hover:text-amber-800 cursor-pointer shrink-0"
                        >
                          <Pin className="h-3.5 w-3.5 fill-current" />
                        </button>
                        <span className="font-bold text-slate-900 text-xs truncate" title={item.key}>
                          {item.key}
                        </span>
                        <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200 px-1 py-0.2 rounded font-semibold shrink-0">
                          {item.type}
                        </span>
                      </div>

                      <div className="font-mono font-bold text-xs text-amber-950 truncate max-w-[50%] text-right bg-white/80 px-2 py-0.5 rounded border border-amber-200">
                        {typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All / Unpinned Variables Section */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {pinnedVariables.length > 0 ? `OTHER VARIABLES (${unpinnedVariables.length})` : `ALL VARIABLES (${unpinnedVariables.length})`}
              </div>

              {unpinnedVariables.length === 0 ? (
                <div className="p-4 text-center text-slate-400 font-sans text-xs bg-white border border-slate-200 rounded-lg">
                  {searchQuery ? `No variables matching "${searchQuery}"` : 'No variables recorded.'}
                </div>
              ) : (
                <div className="space-y-1">
                  {unpinnedVariables.map((item) => (
                    <div
                      key={`unpinned_${item.key}`}
                      className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2 shadow-2xs transition-colors hover:bg-slate-100/60"
                    >
                      <div className="flex items-center space-x-2 min-w-0 max-w-[50%]">
                        <button
                          type="button"
                          onClick={() => handleTogglePin(item.key)}
                          title="Pin Variable to Top"
                          className="text-slate-300 hover:text-amber-500 cursor-pointer shrink-0 transition-colors"
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        <span className="font-bold text-slate-800 text-xs truncate" title={item.key}>
                          {item.key}
                        </span>
                        <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1 py-0.2 rounded font-semibold shrink-0">
                          {item.type}
                        </span>
                      </div>

                      <div className="font-mono text-xs text-slate-900 truncate max-w-[50%] text-right bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DraggableModal>
  );
};
