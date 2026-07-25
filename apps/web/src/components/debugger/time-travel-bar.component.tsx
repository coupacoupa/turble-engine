import React from 'react';
import { Play, Pause, FastForward, Rewind, Activity, Code } from 'lucide-react';
import { ReplayEventLog } from '@/types/matrix.types';

interface TimeTravelBarProps {
  eventLog?: ReplayEventLog;
  currentStepIndex: number;
  onStepChange: (stepIndex: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  currentPayload?: Record<string, any>;
}

export const TimeTravelBar: React.FC<TimeTravelBarProps> = ({
  eventLog,
  currentStepIndex,
  onStepChange,
  isPlaying = false,
  onTogglePlay,
  currentPayload = {},
}) => {
  const totalSteps = eventLog?.stepRecords?.length || 0;
  if (totalSteps === 0) return null;

  const currentStepRecord = eventLog?.stepRecords[currentStepIndex];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm font-mono text-xs text-slate-800 space-y-4">
      {/* Top Bar Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-3">
          <div className="h-7 w-7 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900 flex items-center gap-2 text-xs">
              <span>Time-Travel Replay Debugger</span>
              <span className="text-[10px] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-emerald-700 font-bold">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              Active Step: &quot;{currentStepRecord?.colLabel || `Step ${currentStepIndex + 1}`}&quot;
            </div>
          </div>
        </div>

        {/* Step-Over Buttons */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => onStepChange(Math.max(0, currentStepIndex - 1))}
            disabled={currentStepIndex <= 0}
            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 border border-slate-200 text-slate-700 cursor-pointer"
            title="Step Back"
          >
            <Rewind className="h-3.5 w-3.5" />
          </button>

          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1 shadow-xs cursor-pointer"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
              <span>{isPlaying ? 'Pause' : 'Play Replay'}</span>
            </button>
          )}

          <button
            onClick={() => onStepChange(Math.min(totalSteps - 1, currentStepIndex + 1))}
            disabled={currentStepIndex >= totalSteps - 1}
            className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 border border-slate-200 text-slate-700 cursor-pointer"
            title="Step Next"
          >
            <FastForward className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Timeline Slider */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={totalSteps - 1}
          value={currentStepIndex}
          onChange={(e) => onStepChange(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-emerald-600"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>Step 1: Start</span>
          <span>Step {totalSteps}: Completion</span>
        </div>
      </div>

      {/* Payload Delta Inspector */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between text-slate-600 border-b border-slate-200 pb-1 text-[10px]">
          <span className="flex items-center gap-1.5 font-bold text-slate-900">
            <Code className="h-3.5 w-3.5 text-emerald-600" />
            MUTATED CONTEXT PAYLOAD SNAPSHOT
          </span>
          <span className="text-emerald-700 font-bold">STATUS: REPLAYING</span>
        </div>

        <pre className="text-slate-900 overflow-x-auto p-2.5 bg-white rounded border border-slate-200 text-[11px] font-mono">
          {JSON.stringify(currentPayload, null, 2)}
        </pre>
      </div>
    </div>
  );
};
