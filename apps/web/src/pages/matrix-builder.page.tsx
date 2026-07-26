import React, { useState, useEffect } from 'react';
import { Edit3 } from 'lucide-react';
import { MatrixSchema, DomainRowSchema, StepColumnSchema, RowType, CellSchema } from '@/types/matrix.types';
import { MatrixEvaluatorConnectService, type MatrixExecutionResult } from '@/services/matrix-evaluator.service';
import { WorkflowStorageService } from '@/services/workflow-storage.service';
import { AppHeader } from '@/components/layout/app-header.component';
import { MatrixGrid } from '@/components/matrix-editor/matrix-grid.component';
import { CellEditorDrawer } from '@/components/matrix-editor/cell-editor-drawer.component';
import { TimeTravelBar } from '@/components/debugger/time-travel-bar.component';
import { ExecuteMatrixModal } from '@/components/matrix-editor/execute-matrix-modal.component';

interface MatrixBuilderPageProps {
  workflowId: string;
  onBackToDashboard: () => void;
}

export const MatrixBuilderPage: React.FC<MatrixBuilderPageProps> = ({ workflowId, onBackToDashboard }) => {
  const [matrix, setMatrix] = useState<MatrixSchema | undefined>(() => WorkflowStorageService.getById(workflowId));

  // Drawer selection state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<DomainRowSchema | undefined>();
  const [selectedCol, setSelectedCol] = useState<StepColumnSchema | undefined>();
  const [selectedCell, setSelectedCell] = useState<CellSchema | undefined>();

  // Execution Modal & Replay state
  const [isExecuteModalOpen, setIsExecuteModalOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<MatrixExecutionResult | undefined>();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Sync with storage on change
  useEffect(() => {
    if (matrix) {
      WorkflowStorageService.save(matrix);
    }
  }, [matrix]);

  if (!matrix) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700">Workflow Matrix not found.</p>
          <button
            onClick={onBackToDashboard}
            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold shadow-sm cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Title & Description Editing Handlers
  const handleUpdateName = (name: string) => {
    setMatrix((prev) => (prev ? { ...prev, name } : prev));
  };

  const handleUpdateDescription = (description: string) => {
    setMatrix((prev) => (prev ? { ...prev, description } : prev));
  };

  // Direct Matrix Creation Handler (Header)
  const handleCreateNewMatrix = () => {
    const id = `wf_matrix_${Date.now()}`;
    const newMatrix: MatrixSchema = {
      id,
      name: 'Untitled Matrix Workflow',
      description: 'Newly initialized 2D decision matrix.',
      version: '1.0.0',
      columns: [],
      rows: [],
      cells: {},
    };
    WorkflowStorageService.save(newMatrix);
    setMatrix(newMatrix);
  };

  // Direct Sub-Workflow Matrix Creation Handler (Drawer)
  const handleCreateSubWorkflow = () => {
    const subId = `wf_sub_${Date.now()}`;
    const newSub: MatrixSchema = {
      id: subId,
      name: 'Untitled Sub-Workflow Matrix',
      description: 'Sub-workflow matrix capability.',
      version: '1.0.0',
      columns: [],
      rows: [],
      cells: {},
    };
    WorkflowStorageService.save(newSub);
    if (selectedRow) {
      handleSelectSubWorkflow(subId);
    }
  };

  // Cell Selection Handler
  const handleSelectCell = (row: DomainRowSchema, col: StepColumnSchema, cell?: CellSchema) => {
    setSelectedRow(row);
    setSelectedCol(col);
    setSelectedCell(cell);
    setIsDrawerOpen(true);
  };

  // Cell Save Handler
  const handleSaveCell = (updatedCell: CellSchema) => {
    setMatrix((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cells: {
          ...prev.cells,
          [`${updatedCell.rowId}:${updatedCell.colId}`]: updatedCell,
        },
      };
    });
  };

  // Add Column Handler
  const handleAddColumn = () => {
    const newColOrder = matrix.columns.length;
    const newColId = `col_${Date.now()}`;
    const newCol: StepColumnSchema = {
      id: newColId,
      label: `Step ${newColOrder + 1}`,
      order: newColOrder,
    };
    setMatrix((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: [...prev.columns, newCol],
      };
    });
  };

  // Add Row Handler
  const handleAddRow = (type: RowType) => {
    const newRowOrder = matrix.rows.length;
    const newRowId = `row_${Date.now()}`;
    const newRow: DomainRowSchema = {
      id: newRowId,
      label: type === 'plain' ? `Domain Row #${newRowOrder + 1}` : `Sub-Workflow Row #${newRowOrder + 1}`,
      order: newRowOrder,
      type,
    };
    setMatrix((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: [...prev.rows, newRow],
      };
    });
  };

  // Toggle Interceptor Handler
  const handleToggleInterceptor = (rowId: string) => {
    setMatrix((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) => (r.id === rowId ? { ...r, isInterceptor: !r.isInterceptor } : r)),
      };
    });
  };

  // Delete Row Handler
  const handleDeleteRow = (rowId: string) => {
    setMatrix((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.filter((r) => r.id !== rowId),
      };
    });
  };

  // Select Sub-Workflow Handler
  const handleSelectSubWorkflow = (subWorkflowId: string) => {
    if (!selectedRow) return;
    setMatrix((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) => (r.id === selectedRow.id ? { ...r, subWorkflowId } : r)),
      };
    });
    setSelectedRow((prev) => (prev ? { ...prev, subWorkflowId } : prev));
  };

  // Delete Column Handler
  const handleDeleteColumn = (colId: string) => {
    setMatrix((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.filter((c) => c.id !== colId),
      };
    });
  };

  // Run Matrix Execution via Connect-RPC Backend
  const handleStartExecution = async (inputPayload: Record<string, any>) => {
    setIsExecuting(true);
    try {
      const res = await MatrixEvaluatorConnectService.executeMatrix(matrix.id, inputPayload);
      setExecutionResult(res);
      setCurrentStepIndex(0);
    } catch (err) {
      console.error('[Execute] Connect-RPC call failed:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const stepSnapshot = (() => {
    const log = executionResult?.eventLog;
    if (!log?.stepRecords?.length) return undefined;
    const safeIndex = Math.min(Math.max(0, currentStepIndex), log.stepRecords.length - 1);
    const stepRecord = log.stepRecords[safeIndex];
    return { currentPayload: stepRecord.finalPayload, activeStepRecord: stepRecord };
  })();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header */}
      <AppHeader
        activeMatrixName={matrix.name}
        onBackToDashboard={onBackToDashboard}
        onCreateMatrix={handleCreateNewMatrix}
        onRunExecution={() => setIsExecuteModalOpen(true)}
        isExecuting={isExecuting}
      />

      {/* Main Studio Body */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        {/* Title & Description (Excel / Google Sheets Inline Editing) */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 pb-4 bg-white p-4 rounded-xl shadow-2xs">
          <div className="space-y-1 flex-1 max-w-2xl">
            <div className="flex items-center space-x-2 group">
              <input
                type="text"
                value={matrix.name}
                onChange={(e) => handleUpdateName(e.target.value)}
                placeholder="Matrix Name (e.g. Credit Scorecard Matrix)"
                className="text-xl font-bold text-slate-900 tracking-tight bg-transparent hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-1.5 py-0.5 w-full transition-all"
              />
              <Edit3 className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
            </div>

            <input
              type="text"
              value={matrix.description}
              onChange={(e) => handleUpdateDescription(e.target.value)}
              placeholder="Enter matrix workflow description..."
              className="text-slate-500 text-xs font-mono bg-transparent hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-1.5 py-0.5 w-full transition-all"
            />
          </div>

          <div className="flex items-center space-x-2 font-mono text-xs">
            <span className="bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-md shadow-2xs">
              ID: {matrix.id}
            </span>
            <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-2.5 py-1 rounded-md shadow-2xs">
              v{matrix.version}
            </span>
          </div>
        </div>

        {/* 2D Spreadsheet Matrix Canvas */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500">
            <span>2D SPREADSHEET MATRIX CANVAS</span>
            <span className="text-emerald-700 font-bold">MODE: EDITING</span>
          </div>

          <MatrixGrid
            matrix={matrix}
            activeStepIndex={executionResult ? currentStepIndex : undefined}
            activeCellId={selectedCell?.id}
            onSelectCell={handleSelectCell}
            onAddColumn={handleAddColumn}
            onAddRow={handleAddRow}
            onToggleInterceptor={handleToggleInterceptor}
            onDeleteRow={handleDeleteRow}
            onDeleteColumn={handleDeleteColumn}
          />
        </div>

        {/* Time-Travel Debugger & Telemetry Panel */}
        {executionResult && (
          <TimeTravelBar
            eventLog={executionResult.eventLog}
            currentStepIndex={currentStepIndex}
            onStepChange={(idx) => setCurrentStepIndex(idx)}
            currentPayload={stepSnapshot?.currentPayload}
          />
        )}
      </main>

      {/* Cell Editor Configuration Drawer */}
      <CellEditorDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        row={selectedRow}
        column={selectedCol}
        cell={selectedCell}
        availableSubWorkflows={WorkflowStorageService.getAll()}
        onSaveCell={handleSaveCell}
        onCreateMatrix={handleCreateSubWorkflow}
        onSelectSubWorkflow={handleSelectSubWorkflow}
      />

      {/* Dynamic JSON Execution Payload Modal */}
      <ExecuteMatrixModal
        isOpen={isExecuteModalOpen}
        onClose={() => setIsExecuteModalOpen(false)}
        onRun={handleStartExecution}
        isExecuting={isExecuting}
      />
    </div>
  );
};
