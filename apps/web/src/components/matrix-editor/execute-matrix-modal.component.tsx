import React, { useState } from 'react';
import { Play, Code } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@repo/ui';

interface ExecuteMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRun: (inputPayload: Record<string, any>) => void;
  isExecuting?: boolean;
}

export const ExecuteMatrixModal: React.FC<ExecuteMatrixModalProps> = ({
  isOpen,
  onClose,
  onRun,
  isExecuting = false,
}) => {
  const [jsonInput, setJsonInput] = useState<string>('{\n  \n}');
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    try {
      const parsed = JSON.parse(jsonInput);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Input payload must be a valid JSON object { ... }');
      }
      onRun(parsed);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid JSON syntax');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg font-sans">
        <DialogHeader>
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
              <Code className="h-4 w-4" />
            </div>
            <DialogTitle className="text-sm font-bold text-slate-900 tracking-tight">
              Run Matrix Execution
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 font-mono pt-1">
            Provide the initial input context JSON payload to execute against the 2D matrix engine.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs font-mono">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 flex items-center justify-between">
              <span>Input Context Payload (JSON):</span>
              <span className="text-[10px] text-slate-400">Must be a valid JSON object</span>
            </label>
            <textarea
              rows={7}
              required
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{\n  "variable": "value"\n}'
              className="w-full p-3 rounded-lg bg-slate-950 text-slate-100 border border-slate-800 focus:outline-none focus:border-emerald-600 text-xs font-mono leading-relaxed"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[11px]">
              {error}
            </div>
          )}

          <DialogFooter className="pt-2 font-sans">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isExecuting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isExecuting ? 'Running Engine...' : 'Start Execution'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
