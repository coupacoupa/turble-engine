import React, { useState } from 'react';
import { Plus, Layers } from 'lucide-react';
import { MatrixSchema } from '@turble/engine';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@repo/ui';

interface CreateWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (newMatrix: MatrixSchema) => void;
}

export const CreateWorkflowModal: React.FC<CreateWorkflowModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const id = `wf_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const newMatrix: MatrixSchema = {
      id,
      name: name.trim(),
      description: description.trim(),
      version: version.trim() || '1.0.0',
      columns: [],
      rows: [],
      cells: {},
    };

    onCreate(newMatrix);
    setName('');
    setDescription('');
    setVersion('1.0.0');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg font-sans">
        <DialogHeader>
          <div className="flex items-center space-x-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
              <Layers className="h-4 w-4" />
            </div>
            <DialogTitle className="text-sm font-bold text-slate-900 tracking-tight">
              Create Workflow Matrix
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 font-mono pt-1">
            Initialize a new 2D matrix workflow for decision scorecards or domain orchestrations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Workflow Matrix Name:</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Order Processing Engine"
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-600 font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700">Description:</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter workflow matrix description..."
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-600 text-xs"
            />
          </div>

          <div className="space-y-1.5 font-mono">
            <label className="font-semibold text-slate-700">Semantic Version:</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-600 text-xs font-mono"
            />
          </div>

          <DialogFooter className="pt-2">
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Matrix</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
