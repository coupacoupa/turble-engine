import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MatrixSchema, DomainRowSchema, StepColumnSchema, RowType, CellSchema } from '@/types/matrix.types';
import { MatrixEvaluatorConnectService, type MatrixExecutionResult } from '@/services/matrix-evaluator.service';
import { WorkflowStorageService } from '@/services/workflow-storage.service';
import { SpreadsheetToolbar, WorkflowStudioTab } from '@/components/workflow-editor/spreadsheet-toolbar.component';
import { MatrixSheet, CellExecutionState, getExcelColumnLetter } from '@/components/workflow-editor/matrix-sheet.component';
import { TestInputsModal } from '@/components/workflow-editor/test-inputs-modal.component';
import { CellEditorModal } from '@/components/workflow-editor/cell-editor-modal.component';
import { ActiveDependency } from '@/components/workflow-editor/dependency-connector-overlay.component';
import { TimeTravelBar } from '@/components/debugger/time-travel-bar.component';
import { ExecuteMatrixModal } from '@/components/workflow-editor/execute-matrix-modal.component';
import { ValidationModal } from '@/components/workflow-editor/validation-modal.component';
import { WorkflowValidationService } from '@/services/workflow-validation.service';

interface MatrixBuilderPageProps {
  workflowId: string;
  onBackToDashboard: () => void;
}

const buildInitialInputPayload = (matrix?: MatrixSchema): Record<string, any> => {
  if (!matrix || !matrix.inputs || matrix.inputs.length === 0) return {};
  const payload: Record<string, any> = {};
  matrix.inputs.forEach((inp) => {
    payload[inp.key] = inp.defaultValue !== undefined ? inp.defaultValue : '';
  });
  return payload;
};

export const MatrixBuilderPage: React.FC<MatrixBuilderPageProps> = ({ workflowId, onBackToDashboard }) => {
  const [matrix, setMatrix] = useState<MatrixSchema | undefined>(() => WorkflowStorageService.getById(workflowId));
  const [activeTab, setActiveTab] = useState<WorkflowStudioTab>('design');

  // Drawer selection & dependency graph state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<DomainRowSchema | undefined>();
  const [selectedCol, setSelectedCol] = useState<StepColumnSchema | undefined>();
  const [selectedCell, setSelectedCell] = useState<CellSchema | undefined>();
  const [activeDependency, setActiveDependency] = useState<ActiveDependency | null>(null);
  const [activeDependencies, setActiveDependencies] = useState<ActiveDependency[]>([]);

  // Cell Copy / Cut / Paste State
  const [copiedCell, setCopiedCell] = useState<CellSchema | null>(null);
  const [copiedCellKey, setCopiedCellKey] = useState<string | null>(null);

  // Test & Debug input state & test inputs modal toggle
  const [testInputPayload, setTestInputPayload] = useState<Record<string, any>>(() =>
    buildInitialInputPayload(matrix)
  );
  const [isTestInputsModalOpen, setIsTestInputsModalOpen] = useState<boolean>(true);

  // Ensure new matrix inputs are reflected in test input payload state
  useEffect(() => {
    if (matrix?.inputs) {
      setTestInputPayload((prev) => {
        const updated = { ...prev };
        matrix.inputs?.forEach((inp) => {
          if (updated[inp.key] === undefined) {
            updated[inp.key] = inp.defaultValue !== undefined ? inp.defaultValue : '';
          }
        });
        return updated;
      });
    }
  }, [matrix?.inputs]);

  // Show/Hide Dependency Flows setting state
  const [showFlows, setShowFlows] = useState<boolean>(() => {
    try {
      return localStorage.getItem('turble_show_flows') !== 'false';
    } catch {
      return true;
    }
  });

  const handleToggleFlows = useCallback(() => {
    setShowFlows((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('turble_show_flows', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Modals & Replay state
  const [isExecuteModalOpen, setIsExecuteModalOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<MatrixExecutionResult | undefined>();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Sync with storage on change
  useEffect(() => {
    if (matrix) {
      WorkflowStorageService.save(matrix);
    }
  }, [matrix]);



  // Helper to format cell coordinates as Excel label (e.g. A1, B2)
  const getCellLabelName = useCallback(
    (row: DomainRowSchema, col: StepColumnSchema) => {
      if (!matrix) return `${col.label} ${row.label}`;
      const sortedCols = [...matrix.columns].sort((a, b) => a.order - b.order);
      const sortedRows = [...matrix.rows].sort((a, b) => a.order - b.order);
      const cIdx = sortedCols.findIndex((c) => c.id === col.id);
      const rIdx = sortedRows.findIndex((r) => r.id === row.id);
      if (cIdx === -1 || rIdx === -1) return `${col.label} ${row.label}`;
      return `${getExcelColumnLetter(cIdx)}${rIdx + 1}`;
    },
    [matrix]
  );

  // Copy Cell Handler (Ctrl+C / Cmd+C)
  const handleCopyCell = useCallback(() => {
    if (!selectedRow || !selectedCol || !matrix) return;
    const cellKey = `${selectedRow.id}:${selectedCol.id}`;
    const cell = matrix.cells[cellKey];
    if (!cell) {
      return;
    }
    setCopiedCell(cell);
    setCopiedCellKey(cellKey);
    try {
      navigator.clipboard.writeText(JSON.stringify(cell, null, 2));
    } catch (e) {}
  }, [selectedRow, selectedCol, matrix]);

  // Cut Cell Handler (Ctrl+X / Cmd+X)
  const handleCutCell = useCallback(() => {
    if (!selectedRow || !selectedCol || !matrix) return;
    const cellKey = `${selectedRow.id}:${selectedCol.id}`;
    const cell = matrix.cells[cellKey];
    if (!cell) return;

    setCopiedCell(cell);
    setCopiedCellKey(cellKey);
    const label = getCellLabelName(selectedRow, selectedCol);
    try {
      navigator.clipboard.writeText(JSON.stringify(cell, null, 2));
    } catch (e) {}

    setMatrix((prev) => {
      if (!prev) return prev;
      const nextCells = { ...prev.cells };
      delete nextCells[cellKey];
      return { ...prev, cells: nextCells };
    });

    setSelectedCell(undefined);
  }, [selectedRow, selectedCol, matrix]);

  // Paste Cell Handler (Ctrl+V / Cmd+V)
  const handlePasteCell = useCallback(async () => {
    if (!selectedRow || !selectedCol || !matrix) return;
    const targetCellKey = `${selectedRow.id}:${selectedCol.id}`;
    const label = getCellLabelName(selectedRow, selectedCol);

    let sourceCellToPaste: CellSchema | null = copiedCell;

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'object' && parsed !== null && (parsed.action || parsed.actions)) {
          sourceCellToPaste = parsed;
        }
      }
    } catch (e) {}

    if (!sourceCellToPaste) {
      return;
    }

    const newActions = sourceCellToPaste.actions?.map((act, idx) => ({
      ...act,
      id: `act_${Date.now()}_${idx}`,
    }));

    const pastedCell: CellSchema = {
      ...sourceCellToPaste,
      id: `cell_${Date.now()}`,
      rowId: selectedRow.id,
      colId: selectedCol.id,
      actions: newActions,
    };

    setMatrix((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        cells: {
          ...prev.cells,
          [targetCellKey]: pastedCell,
        },
      };
    });

    setSelectedCell(pastedCell);
  }, [selectedRow, selectedCol, matrix, copiedCell]);

  // Deselect Handler (Escape Key)
  const handleDeselect = useCallback(() => {
    setSelectedRow(undefined);
    setSelectedCol(undefined);
    setSelectedCell(undefined);
    setCopiedCell(null);
    setCopiedCellKey(null);
    setActiveDependency(null);
    setActiveDependencies([]);
  }, []);

  if (!matrix) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
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

  const handleUpdateInputs = (inputs: any[]) => {
    setMatrix((prev) => (prev ? { ...prev, inputs } : prev));
  };

  // Direct Sub-Workflow Matrix Creation Handler
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

  // Cell Single Click Selection Handler — Traces Incoming & Outgoing Dependencies Directly on Sheet
  const handleSelectCell = useCallback(
    (row: DomainRowSchema, col: StepColumnSchema, cell?: CellSchema) => {
      if (!matrix) return;
      setSelectedRow(row);
      setSelectedCol(col);
      setSelectedCell(cell);
      setActiveDependency(null);

      const currentCellKey = `${row.id}:${col.id}`;
      const deps: ActiveDependency[] = [];

      const colOrderMap = new Map(matrix.columns.map((c) => [c.id, c.order]));
      const rowOrderMap = new Map(matrix.rows.map((r) => [r.id, r.order]));

      const actionsList = cell?.actions && cell.actions.length > 0
        ? cell.actions
        : cell?.action && cell.action !== 'passthrough'
        ? [{ type: cell.action, inputs: [], outputs: [], tableRuleConfig: cell.tableRuleConfig }]
        : [];

      const consumedInputs = Array.from(new Set(actionsList.flatMap((a) => a.inputs || [])));
      const producedOutputs = Array.from(new Set(actionsList.flatMap((a) => a.outputs || [])));

      // 1. Trace Incoming Dependencies (Producers ➔ Current Cell)
      consumedInputs.forEach((inpKey) => {
        let producerKey: string | undefined = undefined;
        Object.values(matrix.cells || {}).forEach((otherCell) => {
          if (otherCell.rowId === row.id && otherCell.colId === col.id) return;
          const cOrder = colOrderMap.get(otherCell.colId);
          const rOrder = rowOrderMap.get(otherCell.rowId);

          if (cOrder === undefined || rOrder === undefined) return;
          const isPreceding = cOrder < col.order || (cOrder === col.order && rOrder < row.order);
          if (!isPreceding) return;

          const otherActions = otherCell.actions || (otherCell.action ? [{ type: otherCell.action, outputs: [] }] : []);
          otherActions.forEach((act) => {
            if ((act.outputs || []).includes(inpKey)) {
              producerKey = `${otherCell.rowId}:${otherCell.colId}`;
            }
          });
        });

        if (producerKey) {
          deps.push({
            sourceCellKey: producerKey,
            targetCellKey: currentCellKey,
            variableName: inpKey,
            type: 'incoming',
          });
          return;
        }

        const isWfInput = (matrix.inputs || []).some((i) => i.key === inpKey);
        if (isWfInput) {
          deps.push({
            isWorkflowInput: true,
            targetCellKey: currentCellKey,
            variableName: inpKey,
            type: 'incoming',
          });
        }
      });

      // 2. Trace Outgoing Dependencies (Current Cell ➔ Consumer Cells) & Output Clashes
      producedOutputs.forEach((outKey) => {
        // Check ALL preceding output clash sources (global inputs or preceding cells)
        const clashSources = WorkflowValidationService.getAllOutputClashingSources(outKey, matrix, row.id, col.id);
        clashSources.forEach((src) => {
          deps.push({
            sourceCellKey: src.cellKey,
            isWorkflowInput: src.isWorkflowInput,
            targetCellKey: currentCellKey,
            variableName: outKey,
            type: 'clash',
          });
        });

        // Check succeeding cells for outgoing consumers AND output clashes
        Object.values(matrix.cells || {}).forEach((otherCell) => {
          if (otherCell.rowId === row.id && otherCell.colId === col.id) return;
          const cOrder = colOrderMap.get(otherCell.colId);
          const rOrder = rowOrderMap.get(otherCell.rowId);

          if (cOrder === undefined || rOrder === undefined) return;
          const isSucceeding = cOrder > col.order || (cOrder === col.order && rOrder > row.order);
          if (!isSucceeding) return;

          const otherActions = otherCell.actions || (otherCell.action ? [{ type: otherCell.action, inputs: [], outputs: [] }] : []);

          // Check if succeeding cell also OUTPUTS this variable → clash
          const alsoProducesOutput = otherActions.some((act) => (act.outputs || []).includes(outKey));
          if (alsoProducesOutput) {
            deps.push({
              sourceCellKey: currentCellKey,
              targetCellKey: `${otherCell.rowId}:${otherCell.colId}`,
              variableName: outKey,
              type: 'clash',
            });
          }

          // Check if succeeding cell consumes this variable as input → normal outgoing
          otherActions.forEach((act) => {
            if ((act.inputs || []).includes(outKey)) {
              deps.push({
                sourceCellKey: currentCellKey,
                targetCellKey: `${otherCell.rowId}:${otherCell.colId}`,
                variableName: outKey,
                type: 'outgoing',
              });
            }
          });
        });
      });

      setActiveDependencies(deps);
    },
    [matrix]
  );

  // Cell Double Click Handler — Opens Floating Cell Editor Modal
  const handleDoubleClickCell = useCallback(
    (row: DomainRowSchema, col: StepColumnSchema, cell?: CellSchema) => {
      handleSelectCell(row, col, cell);
      setIsDrawerOpen(true);
    },
    [handleSelectCell]
  );

  // Arrow Key Navigation Handler (Up, Down, Left, Right)
  const handleNavigateCell = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      if (!matrix || !selectedRow || !selectedCol) return;
      const sortedCols = [...matrix.columns].sort((a, b) => a.order - b.order);
      const sortedRows = [...matrix.rows].sort((a, b) => a.order - b.order);

      const cIdx = sortedCols.findIndex((c) => c.id === selectedCol.id);
      const rIdx = sortedRows.findIndex((r) => r.id === selectedRow.id);

      if (cIdx === -1 || rIdx === -1) return;

      let newCIdx = cIdx;
      let newRIdx = rIdx;

      if (dir === 'left') newCIdx = Math.max(0, cIdx - 1);
      if (dir === 'right') newCIdx = Math.min(sortedCols.length - 1, cIdx + 1);
      if (dir === 'up') newRIdx = Math.max(0, rIdx - 1);
      if (dir === 'down') newRIdx = Math.min(sortedRows.length - 1, rIdx + 1);

      const nextCol = sortedCols[newCIdx];
      const nextRow = sortedRows[newRIdx];

      if (!nextCol || !nextRow) return;

      const nextCellKey = `${nextRow.id}:${nextCol.id}`;
      const nextCell = matrix.cells[nextCellKey];
      handleSelectCell(nextRow, nextCol, nextCell);
    },
    [matrix, selectedRow, selectedCol, handleSelectCell]
  );

  // Global Keyboard listener for Ctrl+C, Ctrl+X, Ctrl+V, Escape, Arrow Keys, Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.key === 'Escape') {
        if (isDrawerOpen) {
          setIsDrawerOpen(false);
          return;
        }
        if (isExecuteModalOpen) {
          setIsExecuteModalOpen(false);
          return;
        }
        if (isValidating) {
          setIsValidating(false);
          return;
        }

        if (selectedRow || selectedCol || selectedCell || copiedCellKey) {
          e.preventDefault();
          handleDeselect();
          return;
        }
      }

      if (isInput || isDrawerOpen || isExecuteModalOpen || isValidating) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopyCell();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleCutCell();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteCell();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleNavigateCell('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNavigateCell('down');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigateCell('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigateCell('right');
      } else if (e.key === 'Enter') {
        if (selectedRow && selectedCol) {
          e.preventDefault();
          handleDoubleClickCell(selectedRow, selectedCol, selectedCell);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleCopyCell,
    handleCutCell,
    handlePasteCell,
    handleDeselect,
    handleNavigateCell,
    handleDoubleClickCell,
    selectedRow,
    selectedCol,
    selectedCell,
    copiedCellKey,
    isDrawerOpen,
    isExecuteModalOpen,
    isValidating,
  ]);

  // Hover Input & Output Dependency Tracer Handler
  const handleHoverInput = (inputKey: string | null) => {
    if (!inputKey || !selectedRow || !selectedCol || !matrix) {
      setActiveDependency(null);
      return;
    }

    const targetCellKey = `${selectedRow.id}:${selectedCol.id}`;

    // 0. Check if inputKey has output clashes across all sources
    const clashSources = WorkflowValidationService.getAllOutputClashingSources(inputKey, matrix, selectedRow.id, selectedCol.id);
    if (clashSources.length > 0) {
      const clashDeps: ActiveDependency[] = clashSources.map((src) => ({
        sourceCellKey: src.cellKey,
        isWorkflowInput: src.isWorkflowInput,
        targetCellKey,
        variableName: inputKey,
        type: 'clash',
      }));
      setActiveDependencies((prev) => {
        const nonClashes = prev.filter((d) => d.type !== 'clash');
        return [...nonClashes, ...clashDeps];
      });
      setActiveDependency(clashDeps[0] || null);
      return;
    }

    // 1. Search preceding cells in matrix for the producer of this output variable
    let foundProducerKey: string | undefined = undefined;

    const colOrderMap = new Map(matrix.columns.map((c) => [c.id, c.order]));
    const rowOrderMap = new Map(matrix.rows.map((r) => [r.id, r.order]));

    const currColOrder = selectedCol.order;
    const currRowOrder = selectedRow.order;

    Object.values(matrix.cells || {}).forEach((c) => {
      if (c.rowId === selectedRow.id && c.colId === selectedCol.id) return;
      const cOrder = colOrderMap.get(c.colId);
      const rOrder = rowOrderMap.get(c.rowId);

      if (cOrder === undefined || rOrder === undefined) return;
      const isPreceding = cOrder < currColOrder || (cOrder === currColOrder && rOrder < currRowOrder);

      if (!isPreceding) return;

      const actions = c.actions || (c.action ? [{ type: c.action, outputs: [] }] : []);
      actions.forEach((act) => {
        if ((act.outputs || []).includes(inputKey)) {
          foundProducerKey = `${c.rowId}:${c.colId}`;
        }
      });
    });

    if (foundProducerKey) {
      setActiveDependency({
        sourceCellKey: foundProducerKey,
        targetCellKey,
        variableName: inputKey,
        type: 'incoming',
      });
      return;
    }

    // 2. Fallback: Check if inputKey matches a global workflow input
    const isWfInput = (matrix.inputs || []).some((i) => i.key === inputKey);
    if (isWfInput) {
      setActiveDependency({
        isWorkflowInput: true,
        targetCellKey,
        variableName: inputKey,
        type: 'incoming',
      });
      return;
    }

    setActiveDependency(null);
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
      label: type === 'standard' ? `Row #${newRowOrder + 1}` : `Sub-Workflow Row #${newRowOrder + 1}`,
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

  // Export JSON Schema Handler
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(matrix, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${matrix.id || 'workflow_matrix'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reorder Columns Handler (Drag & Drop)
  const handleReorderColumns = (reorderedCols: StepColumnSchema[]) => {
    setMatrix((prev) => (prev ? { ...prev, columns: reorderedCols } : prev));
  };

  // Reorder Rows Handler (Drag & Drop)
  const handleReorderRows = (reorderedRows: DomainRowSchema[]) => {
    setMatrix((prev) => (prev ? { ...prev, rows: reorderedRows } : prev));
  };

  // Rename Column Handler
  const handleRenameColumn = (colId: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    setMatrix((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((c) => (c.id === colId ? { ...c, label: trimmed } : c)),
      };
    });
  };

  // Rename Row Handler
  const handleRenameRow = (rowId: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    setMatrix((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) => (r.id === rowId ? { ...r, label: trimmed } : r)),
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

  // Cell execution results map for rendering inside spreadsheet cells
  const cellExecutionResults = useMemo(() => {
    if (!executionResult) return {};
    const map: Record<string, CellExecutionState> = {};
    const stepRecords = executionResult.eventLog?.stepRecords || [];
    const maxIdx = activeTab === 'test' ? currentStepIndex : stepRecords.length - 1;

    stepRecords.slice(0, maxIdx + 1).forEach((rec) => {
      rec.cellResults?.forEach((cellRes) => {
        map[`${cellRes.rowId}:${cellRes.colId}`] = {
          mutatedPayload: cellRes.mutatedPayload,
          latencyMs: cellRes.latencyMs,
        };
      });
    });
    return map;
  }, [executionResult, currentStepIndex, activeTab]);

  // Compute test-mode data flow dependencies with values on arrows
  const testModeDependencies = useMemo(() => {
    if (activeTab !== 'test') return activeDependencies;

    const payload = stepSnapshot?.currentPayload || executionResult?.finalPayload || testInputPayload;
    const colOrderMap = new Map(matrix.columns.map((c) => [c.id, c.order]));
    const rowOrderMap = new Map(matrix.rows.map((r) => [r.id, r.order]));

    const deps: ActiveDependency[] = [];

    Object.values(matrix.cells || {}).forEach((cell) => {
      if (!cell || !cell.enabled) return;
      const currentCellKey = `${cell.rowId}:${cell.colId}`;

      const actionsList = cell.actions && cell.actions.length > 0
        ? cell.actions
        : cell.action && cell.action !== 'passthrough'
        ? [{ type: cell.action, inputs: [], outputs: [] }]
        : [];

      const consumedInputs = Array.from(new Set(actionsList.flatMap((a) => a.inputs || [])));

      consumedInputs.forEach((inpKey) => {
        let producerKey: string | undefined = undefined;
        const cOrder = colOrderMap.get(cell.colId);
        const rOrder = rowOrderMap.get(cell.rowId);

        if (cOrder === undefined || rOrder === undefined) return;

        Object.values(matrix.cells || {}).forEach((otherCell) => {
          if (otherCell.rowId === cell.rowId && otherCell.colId === cell.colId) return;
          const otherCOrder = colOrderMap.get(otherCell.colId);
          const otherROrder = rowOrderMap.get(otherCell.rowId);

          if (otherCOrder === undefined || otherROrder === undefined) return;
          const isPreceding = otherCOrder < cOrder || (otherCOrder === cOrder && otherROrder < rOrder);
          if (!isPreceding) return;

          const otherActions = otherCell.actions || (otherCell.action ? [{ type: otherCell.action, outputs: [] }] : []);
          otherActions.forEach((act) => {
            if ((act.outputs || []).includes(inpKey)) {
              producerKey = `${otherCell.rowId}:${otherCell.colId}`;
            }
          });
        });

        const runtimeVal = payload?.[inpKey];

        if (producerKey) {
          deps.push({
            sourceCellKey: producerKey,
            targetCellKey: currentCellKey,
            variableName: inpKey,
            type: 'incoming',
            value: runtimeVal,
          });
        } else {
          const isWfInput = (matrix.inputs || []).some((i) => i.key === inpKey) || (inpKey in (testInputPayload || {}));
          if (isWfInput) {
            deps.push({
              isWorkflowInput: true,
              targetCellKey: currentCellKey,
              variableName: inpKey,
              type: 'incoming',
              value: runtimeVal,
            });
          }
        }
      });
    });

    return deps;
  }, [activeTab, matrix, executionResult, stepSnapshot, testInputPayload, activeDependencies]);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 font-sans overflow-hidden select-none">
      {/* 1. Header & Wireframe Toolbar Layout */}
      <SpreadsheetToolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        matrix={matrix}
        selectedRow={selectedRow}
        selectedCol={selectedCol}
        selectedCell={selectedCell}
        onUpdateName={handleUpdateName}
        onUpdateDescription={handleUpdateDescription}
        onAddColumn={handleAddColumn}
        onAddRow={handleAddRow}
        onRunExecution={() => handleStartExecution(testInputPayload)}
        isExecuting={isExecuting}
        onBackToDashboard={onBackToDashboard}
        onOpenValidation={() => setIsValidating(true)}
        onExportJson={handleExportJson}
        onUpdateInputs={handleUpdateInputs}
        onToggleTestInputsModal={() => setIsTestInputsModalOpen((prev) => !prev)}
        isTestInputsModalOpen={isTestInputsModalOpen}
        showFlows={showFlows}
        onToggleFlows={handleToggleFlows}
      />

      {/* 2. Main Studio Content View — Unified Sheet View across Design & Test Tabs */}
      <div className="flex-1 w-full h-full flex flex-row overflow-hidden relative min-h-0">
        <div className="flex-1 flex flex-col min-w-0 h-full relative">
          <MatrixSheet
            matrix={matrix}
            activeStepIndex={executionResult ? currentStepIndex : undefined}
            selectedRowId={selectedRow?.id}
            selectedColId={selectedCol?.id}
            copiedCellKey={copiedCellKey}
            activeDependency={activeDependency}
            dependencies={testModeDependencies}
            cellExecutionResults={cellExecutionResults}
            showFlows={showFlows}
            onSelectCell={handleSelectCell}
            onDoubleClickCell={handleDoubleClickCell}
            onAddColumn={handleAddColumn}
            onAddRow={handleAddRow}
            onToggleInterceptor={handleToggleInterceptor}
            onDeleteRow={handleDeleteRow}
            onDeleteColumn={handleDeleteColumn}
            onReorderColumns={handleReorderColumns}
            onReorderRows={handleReorderRows}
            onRenameColumn={handleRenameColumn}
            onRenameRow={handleRenameRow}
          />

          {executionResult && (
            <TimeTravelBar
              eventLog={executionResult.eventLog}
              currentStepIndex={currentStepIndex}
              onStepChange={(idx) => setCurrentStepIndex(idx)}
              currentPayload={stepSnapshot?.currentPayload}
            />
          )}
        </div>
      </div>

      {/* Floating Draggable & Resizable Test Inputs Modal */}
      {activeTab === 'test' && (
        <TestInputsModal
          isOpen={isTestInputsModalOpen}
          onClose={() => setIsTestInputsModalOpen(false)}
          matrix={matrix}
          inputPayload={testInputPayload}
          onUpdateInputPayload={setTestInputPayload}
          onRunExecution={handleStartExecution}
          isExecuting={isExecuting}
          executionResult={executionResult}
        />
      )}

      {/* 3. Floating Draggable & Resizable Cell Editor Modal */}
      <CellEditorModal
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        matrix={matrix}
        row={selectedRow}
        column={selectedCol}
        cell={selectedCell}
        availableSubWorkflows={WorkflowStorageService.getAll()}
        onSaveCell={handleSaveCell}
        onCreateMatrix={handleCreateSubWorkflow}
        onSelectSubWorkflow={handleSelectSubWorkflow}
        onHoverInput={handleHoverInput}
      />

      {/* 4. Rule Audit & Validation Modal */}
      <ValidationModal isOpen={isValidating} onClose={() => setIsValidating(false)} matrix={matrix} />

      {/* 5. Execution Input Payload Modal */}
      <ExecuteMatrixModal
        isOpen={isExecuteModalOpen}
        onClose={() => setIsExecuteModalOpen(false)}
        onRun={handleStartExecution}
        isExecuting={isExecuting}
      />
    </div>
  );
};

