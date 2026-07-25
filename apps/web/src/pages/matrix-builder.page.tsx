import React, { useState, useEffect } from 'react';
import { MatrixSchema, DomainRowSchema, StepColumnSchema, RowType, CellSchema } from '@/types/matrix.types';
import { MockEvaluatorService, MatrixExecutionResult } from '@/services/mock-evaluator.service';
import { WorkflowStorageService } from '@/services/workflow-storage.service';
import { MatrixEvaluatorConnectService } from '@/services/matrix-evaluator.service';
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

  // Run Matrix Execution Simulation
  const handleStartExecution = async (inputPayload: Record<string, any>) => {
    setIsExecuting(true);
    const res = MockEvaluatorService.executeMatrix(matrix, inputPayload);
    setExecutionResult(res);
    setCurrentStepIndex(0);
    setIsExecuting(false);
  };

  const stepSnapshot = executionResult?.eventLog
    ? MockEvaluatorService.replayUntilStep(executionResult.eventLog, currentStepIndex)
    : undefined;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header */}
      <AppHeader
        activeMatrixName={matrix.name}
        onBackToDashboard={onBackToDashboard}
        onRunExecution={() => setIsExecuteModalOpen(true)}
        isExecuting={isExecuting}
      />

      {/* Main Studio Body */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 w-full">
        {/* Title & Description */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{matrix.name}</h1>
            <p className="text-slate-500 text-xs mt-0.5 font-mono">{matrix.description || 'No description'}</p>
          </div>

          <div className="flex items-center space-x-2 font-mono text-xs">
            <span className="bg-white border border-slate-200 text-slate-600 font-bold px-2.5 py-1 rounded-md shadow-2xs">
              VERSION: {matrix.version}
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
