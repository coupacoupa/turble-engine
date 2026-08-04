import React from "react";
import { Plus, Play, ArrowLeft, Cpu } from "lucide-react";
import { UserButton } from "@neondatabase/neon-js/auth/react/ui";

interface AppHeaderProps {
  activeMatrixName?: string;
  onCreateMatrix?: () => void;
  onRunExecution?: () => void;
  isExecuting?: boolean;
  onBackToDashboard?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeMatrixName,
  onCreateMatrix,
  onRunExecution,
  isExecuting = false,
  onBackToDashboard,
}) => {
  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between text-xs font-sans shadow-xs">
      <div className="flex items-center space-x-4">
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        <div
          onClick={onBackToDashboard}
          className="flex items-center space-x-2.5 cursor-pointer group"
        >
          <img
            src="/logo.png"
            alt="Turble Logo"
            className="h-7 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform"
          />
          <span className="font-bold text-slate-900 tracking-tight text-sm">
            Turble Engine
          </span>
        </div>

        {activeMatrixName && (
          <div className="hidden sm:flex items-center space-x-2 border-l border-slate-200 pl-4 font-mono">
            <Cpu className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-slate-800 font-semibold">
              {activeMatrixName}
            </span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
              2D MATRIX
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2.5">
        {onRunExecution && (
          <button
            onClick={onRunExecution}
            disabled={isExecuting}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{isExecuting ? "Executing..." : "Run Matrix Engine"}</span>
          </button>
        )}

        {onCreateMatrix && (
          <button
            onClick={onCreateMatrix}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Workflow Matrix</span>
          </button>
        )}

        {/* Account menu (profile, settings, sign out) */}
        <UserButton size="icon" />
      </div>
    </header>
  );
};
