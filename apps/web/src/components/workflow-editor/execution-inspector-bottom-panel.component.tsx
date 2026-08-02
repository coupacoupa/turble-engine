import { MatrixExecutionResult } from "@/services/matrix-evaluator.service";
import {
  CellActionItem,
  MatrixSchema,
  StepEvaluationRecord,
  WorkflowInputField,
  WorkflowOutputField,
} from "@/types/matrix.types";
import { getCellActions } from "@/utils/cell-actions.util";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FastForward,
  Pause,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Rewind,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

export interface TestCaseInstance {
  id: string;
  name: string;
  inputPayload: Record<string, any>;
  executionResult?: MatrixExecutionResult;
  currentStepIndex: number;
}

interface ExecutionInspectorBottomPanelProps {
  isOpen: boolean;
  onClose: () => void;
  matrix: MatrixSchema;
  initialInputPayload: Record<string, any>;
  onRunExecution: (
    payload: Record<string, any>,
  ) => Promise<MatrixExecutionResult>;
  isExecuting: boolean;
  onHoverStepRecord: (step?: StepEvaluationRecord) => void;
  onHoverVariableKey?: (key?: string) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

export const ExecutionInspectorBottomPanel: React.FC<
  ExecutionInspectorBottomPanelProps
> = ({
  isOpen,
  onClose,
  matrix,
  initialInputPayload,
  onRunExecution,
  isExecuting,
  onHoverStepRecord,
  onHoverVariableKey,
  isPlaying = false,
  onTogglePlay,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [panelHeight, setPanelHeight] = useState<number>(420);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [activeLeftTab, setActiveLeftTab] = useState<"inputs" | "steps">(
    "inputs",
  );

  // Excel-Style Multi-Test Case Tabs State
  const [testCases, setTestCases] = useState<TestCaseInstance[]>(() => [
    {
      id: "tc_1",
      name: "Test Case 1",
      inputPayload: initialInputPayload,
      currentStepIndex: 0,
    },
  ]);
  const [activeTestCaseId, setActiveTestCaseId] = useState<string>("tc_1");
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingNameText, setEditingNameText] = useState<string>("");

  // Form vs JSON state for active test case
  const [isJsonMode, setIsJsonMode] = useState<boolean>(false);
  const [jsonText, setJsonText] = useState<string>(
    JSON.stringify(initialInputPayload, null, 2),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [inputSearchQuery, setInputSearchQuery] = useState<string>("");

  // Variable Inspector Search & Pin state
  const [varSearchQuery, setVarSearchQuery] = useState<string>("");
  const [pinnedVariableKeys, setPinnedVariableKeys] = useState<Set<string>>(
    new Set<string>(),
  );

  const resizeStartYRef = useRef<number>(0);
  const resizeStartHeightRef = useRef<number>(380);

  // Active Test Case Instance getter
  const activeTestCase = useMemo(() => {
    return testCases.find((tc) => tc.id === activeTestCaseId) || testCases[0];
  }, [testCases, activeTestCaseId]);

  // Sync jsonText when active test case changes
  useEffect(() => {
    if (activeTestCase) {
      setJsonText(JSON.stringify(activeTestCase.inputPayload || {}, null, 2));
    }
  }, [activeTestCaseId]);

  const workflowInputs = matrix.inputs || [];
  const currentStepIndex = activeTestCase?.currentStepIndex || 0;
  const executionResult = activeTestCase?.executionResult;
  const stepRecords = executionResult?.eventLog?.stepRecords || [];
  const totalSteps = stepRecords.length;

  // Derive field list for inputs
  const allFieldKeys = useMemo<WorkflowInputField[]>(() => {
    if (workflowInputs.length > 0) return workflowInputs;
    const payload = activeTestCase?.inputPayload || {};
    return Object.keys(payload).map((key) => ({
      id: key,
      key,
      type: (typeof payload[key] === "boolean"
        ? "boolean"
        : typeof payload[key] === "number"
          ? "number"
          : "string") as any,
      required: true,
      defaultValue: payload[key],
    }));
  }, [workflowInputs, activeTestCase?.inputPayload]);

  const filteredInputFields = useMemo(() => {
    if (!inputSearchQuery.trim()) return allFieldKeys;
    const q = inputSearchQuery.toLowerCase().trim();
    return allFieldKeys.filter(
      (f) =>
        f.key.toLowerCase().includes(q) || f.type.toLowerCase().includes(q),
    );
  }, [allFieldKeys, inputSearchQuery]);

  // Update active test case property helper
  const updateActiveTestCase = (
    updater: (tc: TestCaseInstance) => TestCaseInstance,
  ) => {
    setTestCases((prev) =>
      prev.map((tc) => (tc.id === activeTestCase.id ? updater(tc) : tc)),
    );
  };

  // Handle single field input changes
  const handleFieldChange = (key: string, value: any) => {
    const updatedPayload = {
      ...(activeTestCase.inputPayload || {}),
      [key]: value,
    };
    updateActiveTestCase((tc) => ({ ...tc, inputPayload: updatedPayload }));
    setJsonText(JSON.stringify(updatedPayload, null, 2));
  };

  // Reset inputs to schema defaults
  const handleResetToDefaults = () => {
    const resetPayload: Record<string, any> = {};
    allFieldKeys.forEach((f) => {
      resetPayload[f.key] = f.defaultValue !== undefined ? f.defaultValue : "";
    });
    updateActiveTestCase((tc) => ({ ...tc, inputPayload: resetPayload }));
    setJsonText(JSON.stringify(resetPayload, null, 2));
    setJsonError(null);
  };

  // Clear inputs
  const handleClearAllInputs = () => {
    const clearedPayload: Record<string, any> = {};
    allFieldKeys.forEach((f) => {
      clearedPayload[f.key] = "";
    });
    updateActiveTestCase((tc) => ({ ...tc, inputPayload: clearedPayload }));
    setJsonText(JSON.stringify(clearedPayload, null, 2));
    setJsonError(null);
  };

  // JSON raw text handler
  const handleJsonTextChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setJsonError(null);
      updateActiveTestCase((tc) => ({ ...tc, inputPayload: parsed }));
    } catch (err: any) {
      setJsonError(err.message || "Invalid JSON syntax");
    }
  };

  // Run simulation for active test case
  const handleRunSimulation = async () => {
    let payloadToRun = activeTestCase.inputPayload;
    if (isJsonMode) {
      try {
        payloadToRun = JSON.parse(jsonText);
        setJsonError(null);
      } catch (err: any) {
        setJsonError(err.message || "Cannot parse JSON");
        return;
      }
    }
    const res = await onRunExecution(payloadToRun);
    updateActiveTestCase((tc) => ({
      ...tc,
      executionResult: res,
      // Land on the final step by default: the completed run with all outputs
      currentStepIndex: Math.max(
        0,
        (res.eventLog?.stepRecords?.length ?? 1) - 1,
      ),
    }));
    setActiveLeftTab("steps");
  };

  // Add new Test Case tab
  const handleAddTestCase = () => {
    const newId = `tc_${Date.now()}`;
    const newName = `Test Case ${testCases.length + 1}`;
    const newTc: TestCaseInstance = {
      id: newId,
      name: newName,
      inputPayload: {
        ...(activeTestCase?.inputPayload || initialInputPayload),
      },
      currentStepIndex: 0,
    };
    setTestCases((prev) => [...prev, newTc]);
    setActiveTestCaseId(newId);
    setActiveLeftTab("inputs");
  };

  // Delete Test Case tab
  const handleDeleteTestCase = (id: string) => {
    if (testCases.length <= 1) return;
    const remaining = testCases.filter((tc) => tc.id !== id);
    setTestCases(remaining);
    if (activeTestCaseId === id) {
      setActiveTestCaseId(remaining[remaining.length - 1].id);
    }
  };

  // Rename Test Case tab
  const handleStartRename = (tc: TestCaseInstance) => {
    setEditingTabId(tc.id);
    setEditingNameText(tc.name);
  };

  const handleSaveRename = () => {
    if (editingTabId && editingNameText.trim()) {
      setTestCases((prev) =>
        prev.map((tc) =>
          tc.id === editingTabId ? { ...tc, name: editingNameText.trim() } : tc,
        ),
      );
    }
    setEditingTabId(null);
  };

  // Active step record calculation
  const activeStepRecord = useMemo(() => {
    if (!stepRecords.length) return undefined;
    const safeIdx = Math.min(
      Math.max(0, currentStepIndex),
      stepRecords.length - 1,
    );
    return stepRecords[safeIdx];
  }, [stepRecords, currentStepIndex]);

  // Current payload at active step snapshot
  const activePayload = useMemo<Record<string, any>>(() => {
    return (
      activeStepRecord?.finalPayload ||
      executionResult?.finalPayload ||
      activeTestCase?.inputPayload ||
      {}
    );
  }, [activeStepRecord, executionResult, activeTestCase?.inputPayload]);

  // All variable entries derived from schema inputs, schema outputs, cell outputs, and runtime payload
  const allVariableEntries = useMemo(() => {
    const payload =
      activeStepRecord?.finalPayload ||
      executionResult?.finalPayload ||
      activeTestCase?.inputPayload ||
      {};
    const map = new Map<
      string,
      {
        key: string;
        value: any;
        type: string;
        isOutput: boolean;
        coordinates: { colLetter: string; rowNum: number; fullLabel: string }[];
      }
    >();

    const getExcelColumnLetter = (colIndex: number): string => {
      let letter = "";
      let temp = colIndex;
      while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    };

    const sortedCols = [...(matrix.columns || [])].sort(
      (a, b) => a.order - b.order,
    );
    const sortedRows = [...(matrix.rows || [])].sort(
      (a, b) => a.order - b.order,
    );

    // Helper to calculate cell coordinate lineage for inputs/outputs
    const getCoordinatesForVariable = (varKey: string, isOutput: boolean) => {
      const coords: { colLetter: string; rowNum: number; fullLabel: string }[] =
        [];
      const seenKeys = new Set<string>();

      Object.values(matrix.cells || {}).forEach((cell) => {
        const col = matrix.columns.find((c) => c.id === cell.colId);
        const row = matrix.rows.find((r) => r.id === cell.rowId);
        if (!col || !row) return;

        const colIdx = sortedCols.findIndex((c) => c.id === cell.colId);
        const rowIdx = sortedRows.findIndex((r) => r.id === cell.rowId);
        if (colIdx < 0 || rowIdx < 0) return;

        const colLetter = getExcelColumnLetter(colIdx);
        const rowNum = rowIdx + 1;
        const fullLabel = `${col.label} × ${row.label}`;
        const keyStr = `${colLetter}${rowNum}`;

        const actionsList: CellActionItem[] = getCellActions(cell);

        let isMatch = false;
        actionsList.forEach((act) => {
          if (isOutput) {
            if (act.outputs?.includes(varKey)) isMatch = true;
            if (act.tableRuleConfig?.rules) {
              act.tableRuleConfig.rules.forEach((r) => {
                if (r.mutations && varKey in r.mutations) isMatch = true;
              });
            }
          } else {
            if (act.inputs?.includes(varKey)) isMatch = true;
            if (act.tableRuleConfig?.rules) {
              act.tableRuleConfig.rules.forEach((r) => {
                if (r.conditions && varKey in r.conditions) isMatch = true;
              });
            }
          }
        });

        if (isMatch && !seenKeys.has(keyStr)) {
          seenKeys.add(keyStr);
          coords.push({ colLetter, rowNum, fullLabel });
        }
      });
      return coords;
    };

    // 1. Add all schema inputs first
    (matrix.inputs || []).forEach((inp) => {
      map.set(inp.key, {
        key: inp.key,
        value:
          payload[inp.key] !== undefined ? payload[inp.key] : inp.defaultValue,
        type: inp.type || typeof payload[inp.key],
        isOutput: false,
        coordinates: getCoordinatesForVariable(inp.key, false),
      });
    });

    // 2. Add all schema outputs next
    (matrix.outputSchema || []).forEach((out: WorkflowOutputField) => {
      map.set(out.key, {
        key: out.key,
        value: payload[out.key] !== undefined ? payload[out.key] : undefined,
        type:
          out.type ||
          (payload[out.key] !== undefined ? typeof payload[out.key] : "string"),
        isOutput: true,
        coordinates: getCoordinatesForVariable(out.key, true),
      });
    });

    // 3. Add any cell action outputs declared across matrix cells
    Object.values(matrix.cells || {}).forEach((cell) => {
      const actionsList: CellActionItem[] =
        cell.actions ||
        (cell.action
          ? [
              {
                id: cell.id,
                order: 0,
                type: cell.action,
                tableRuleConfig: cell.tableRuleConfig,
                inputs: [],
                outputs: [],
              },
            ]
          : []);
      actionsList.forEach((act) => {
        (act.outputs || []).forEach((outKey) => {
          if (!map.has(outKey)) {
            map.set(outKey, {
              key: outKey,
              value:
                payload[outKey] !== undefined ? payload[outKey] : undefined,
              type:
                payload[outKey] !== undefined
                  ? typeof payload[outKey]
                  : "string",
              isOutput: true,
              coordinates: getCoordinatesForVariable(outKey, true),
            });
          }
        });
      });
    });

    // 4. Include all runtime payload entries
    Object.entries(payload).forEach(([k, v]) => {
      const existing = map.get(k);
      if (existing) {
        existing.value = v;
      } else {
        map.set(k, {
          key: k,
          value: v,
          type: typeof v,
          isOutput: true,
          coordinates: getCoordinatesForVariable(k, true),
        });
      }
    });

    return Array.from(map.values());
  }, [activeStepRecord, executionResult, activeTestCase?.inputPayload, matrix]);

  // Filtered variables based on search query
  const filteredVariables = useMemo(() => {
    if (!varSearchQuery.trim()) return allVariableEntries;
    const q = varSearchQuery.toLowerCase().trim();
    return allVariableEntries.filter(
      (item) =>
        item.key.toLowerCase().includes(q) ||
        String(item.value).toLowerCase().includes(q),
    );
  }, [allVariableEntries, varSearchQuery]);

  // Split into Pinned vs Unpinned variables
  const pinnedVariables = useMemo(() => {
    return filteredVariables.filter((item) => pinnedVariableKeys.has(item.key));
  }, [filteredVariables, pinnedVariableKeys]);

  const unpinnedVariables = useMemo(() => {
    return filteredVariables.filter(
      (item) => !pinnedVariableKeys.has(item.key),
    );
  }, [filteredVariables, pinnedVariableKeys]);

  // Toggle variable pin state
  const handleTogglePin = (key: string) => {
    setPinnedVariableKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Vertical resize drag handlers
  const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = panelHeight;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaY = resizeStartYRef.current - e.clientY;
        const newHeight = Math.min(
          Math.max(200, resizeStartHeightRef.current + deltaY),
          window.innerHeight - 80,
        );
        setPanelHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  if (!isOpen) return null;

  const currentCellRes = activeStepRecord?.cellResults?.[0];
  const currentRowObj = matrix.rows.find((r) => r.id === currentCellRes?.rowId);
  const currentColObj = matrix.columns.find(
    (c) => c.id === currentCellRes?.colId,
  );
  const activeStepLabel = `${currentColObj?.label || activeStepRecord?.colLabel || "Col"} × ${currentRowObj?.label || currentCellRes?.rowId || "Row"}`;
  const renderVariableValueBox = (value: any, isPinned = false) => {
    const isPending =
      value === undefined ||
      value === "undefined" ||
      value === null ||
      value === "";
    const formatted = isPending
      ? "—"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

    return (
      <div
        className={`w-24 sm:w-28 shrink-0 text-right px-2 py-0.5 rounded border text-xs md:text-sm font-mono truncate ${
          isPending
            ? "bg-slate-50/80 border-slate-200 text-slate-400 italic font-normal text-center"
            : isPinned
              ? "bg-white/90 border-amber-200 text-amber-950 font-bold"
              : "bg-slate-50 border-slate-200 text-slate-900 font-semibold"
        }`}
        title={isPending ? "Not evaluated yet" : formatted}
      >
        {formatted}
      </div>
    );
  };

  return (
    <div
      style={isExpanded ? { height: `${panelHeight}px` } : undefined}
      className={`fixed bottom-0 left-0 right-0 z-docked-panel bg-white border-t border-slate-300 shadow-2xl text-xs md:text-sm flex flex-col font-mono transition-shadow ${
        isResizing ? "select-none ring-2 ring-emerald-500/40" : ""
      }`}
    >
      {/* Top Edge Drag-to-Resize Handle */}
      {isExpanded && (
        <div
          onMouseDown={handleResizeMouseDown}
          className="h-1.5 w-full bg-slate-200/90 hover:bg-slate-300 border-b border-slate-200 transition-colors cursor-ns-resize flex items-center justify-center group shrink-0"
          title="Drag up or down to resize bottom execution inspector height"
        >
          <div className="w-10 h-0.5 bg-slate-400 group-hover:bg-slate-600 rounded-full" />
        </div>
      )}

      {/* 1. Header Toolbar (Docked Control Bar) */}
      <div className="px-3.5 py-1.5 bg-slate-100/95 border-b border-slate-200 text-slate-800 flex items-center justify-between gap-3 shrink-0 select-none">
        {/* Left: Title */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-1.5 font-bold text-xs text-slate-900">
            <span>Execution Inspector</span>
          </div>
        </div>

        {/* Center: Playback Controls & Timeline Slider */}
        <div className="flex-1 max-w-xl flex items-center space-x-3 mx-2">
          <button
            onClick={() =>
              updateActiveTestCase((tc) => ({
                ...tc,
                currentStepIndex: Math.max(0, tc.currentStepIndex - 1),
              }))
            }
            disabled={totalSteps === 0 || currentStepIndex <= 0}
            className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600 cursor-pointer"
            title="Step Back"
          >
            <Rewind className="h-3.5 w-3.5" />
          </button>

          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              disabled={totalSteps === 0}
              className="px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3 fill-current" />
              )}
              <span>{isPlaying ? "Pause" : "Play"}</span>
            </button>
          )}

          <button
            onClick={() =>
              updateActiveTestCase((tc) => ({
                ...tc,
                currentStepIndex: Math.min(
                  totalSteps - 1,
                  tc.currentStepIndex + 1,
                ),
              }))
            }
            disabled={totalSteps === 0 || currentStepIndex >= totalSteps - 1}
            className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 text-slate-600 cursor-pointer"
            title="Step Next"
          >
            <FastForward className="h-3.5 w-3.5" />
          </button>

          <input
            type="range"
            min={0}
            max={Math.max(0, totalSteps - 1)}
            value={currentStepIndex}
            onChange={(e) =>
              updateActiveTestCase((tc) => ({
                ...tc,
                currentStepIndex: Number(e.target.value),
              }))
            }
            disabled={totalSteps === 0}
            className="flex-1 h-1.5 bg-slate-200 rounded appearance-none cursor-pointer accent-slate-700 disabled:opacity-40"
          />
        </div>

        {/* Right: Expand/Collapse & Close */}
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer flex items-center space-x-1 text-[11px]"
            title={isExpanded ? "Collapse Inspector" : "Expand Inspector"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
            <span className="text-[10px] hidden sm:inline font-semibold">
              {isExpanded ? "Collapse" : "Expand"}
            </span>
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
            title="Close Execution Inspector"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Excel Sheet-Style Test Case Tabs Bar */}
      <div className="flex items-center px-3 py-1 bg-slate-200/80 border-b border-slate-300 gap-1 font-mono text-[11px] overflow-x-auto shrink-0 select-none">
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mr-1 shrink-0">
          Test Cases:
        </span>
        {testCases.map((tc) => {
          const isActive = tc.id === activeTestCaseId;
          const isEditing = editingTabId === tc.id;

          return (
            <div
              key={tc.id}
              onClick={() => setActiveTestCaseId(tc.id)}
              className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-t-md border-t border-x cursor-pointer transition-all shrink-0 ${
                isActive
                  ? "bg-white text-slate-900 border-slate-300 font-bold shadow-2xs"
                  : "bg-slate-100/90 text-slate-600 border-slate-300/70 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {isEditing ? (
                <div
                  className="flex items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    value={editingNameText}
                    onChange={(e) => setEditingNameText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveRename()}
                    onBlur={handleSaveRename}
                    autoFocus
                    className="w-24 px-1 py-0 rounded border border-slate-300 text-xs bg-white focus:outline-none"
                  />
                </div>
              ) : (
                <span
                  onDoubleClick={() => handleStartRename(tc)}
                  className="truncate max-w-30 select-none"
                  title="Double-click to rename"
                >
                  {tc.name}
                </span>
              )}

              {testCases.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTestCase(tc.id);
                  }}
                  className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                  title="Close Test Case"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={handleAddTestCase}
          className="flex items-center space-x-1 px-2 py-0.5 rounded-t-md bg-white/70 hover:bg-white text-slate-700 border border-slate-300 text-[10px] font-bold cursor-pointer transition-colors shrink-0"
          title="Add New Test Case"
        >
          <Plus className="h-3 w-3 text-slate-600" />
          <span>New Case</span>
        </button>
      </div>

      {/* 3. Expanded Detail Inspector Body */}
      {isExpanded && (
        <div className="flex-1 flex flex-col md:flex-row bg-slate-50 overflow-hidden text-xs min-h-0">
          {/* Left Panel: Tab Switcher (Inputs vs Step Sequence) */}
          <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 min-h-0">
            {/* Tab Header Bar */}
            <div className="p-2 border-b border-slate-200 bg-slate-100/80 flex items-center justify-between gap-2 shrink-0 font-mono">
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-[11px] font-bold">
                <button
                  onClick={() => setActiveLeftTab("inputs")}
                  className={`px-3 py-0.5 rounded transition-all cursor-pointer ${
                    activeLeftTab === "inputs"
                      ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Inputs ({allFieldKeys.length})
                </button>
                <button
                  onClick={() => setActiveLeftTab("steps")}
                  className={`px-3 py-0.5 rounded transition-all cursor-pointer ${
                    activeLeftTab === "steps"
                      ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Execution Trace ({totalSteps})
                </button>
              </div>

              {activeLeftTab === "inputs" && (
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={handleResetToDefaults}
                    className="p-1 rounded hover:bg-slate-200 text-slate-600"
                    title="Reset to defaults"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                  <button
                    onClick={handleClearAllInputs}
                    className="p-1 rounded hover:bg-rose-50 text-slate-600 hover:text-rose-600"
                    title="Clear inputs"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Left Tab Body Content */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0 font-mono text-[11px]">
              {activeLeftTab === "inputs" ? (
                /* Inputs Tab View */
                <div className="space-y-2 flex flex-col h-full">
                  {/* Form vs JSON Toggle */}
                  <div className="flex items-center justify-between shrink-0">
                    <span className="font-bold text-slate-700 text-[10px]">
                      PAYLOAD VALUES
                    </span>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-[9px] font-bold">
                      <button
                        onClick={() => setIsJsonMode(false)}
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          !isJsonMode
                            ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                            : "text-slate-600"
                        }`}
                      >
                        Form
                      </button>
                      <button
                        onClick={() => setIsJsonMode(true)}
                        className={`px-2 py-0.5 rounded cursor-pointer ${
                          isJsonMode
                            ? "bg-white text-slate-900 shadow-2xs font-extrabold"
                            : "text-slate-600"
                        }`}
                      >
                        JSON
                      </button>
                    </div>
                  </div>

                  {!isJsonMode ? (
                    <div className="space-y-1.5 flex-1 overflow-y-auto min-h-0">
                      {allFieldKeys.length > 3 && (
                        <div className="relative mb-1">
                          <Search className="h-3 w-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={inputSearchQuery}
                            onChange={(e) =>
                              setInputSearchQuery(e.target.value)
                            }
                            placeholder="Filter inputs..."
                            className="w-full pl-7 pr-2 py-1 rounded border border-slate-300 bg-white text-[10px] focus:outline-none"
                          />
                        </div>
                      )}

                      {filteredInputFields.map((field) => {
                        const currentVal =
                          (activeTestCase.inputPayload || {})[field.key] ??
                          (field.defaultValue !== undefined
                            ? field.defaultValue
                            : "");

                        return (
                          <div
                            key={field.key}
                            className="flex items-center justify-between gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-center space-x-1.5 min-w-0 shrink-0 max-w-[45%]">
                              <span
                                className="font-bold text-slate-800 truncate"
                                title={field.key}
                              >
                                {field.key}
                              </span>
                            </div>

                            <div className="flex-1 max-w-[55%] flex justify-end">
                              {field.type === "boolean" ? (
                                <div className="flex items-center space-x-1 w-full max-w-27.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleFieldChange(field.key, true)
                                    }
                                    className={`flex-1 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                                      currentVal === true
                                        ? "bg-emerald-100 border-emerald-400 text-emerald-950"
                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                                    }`}
                                  >
                                    TRUE
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleFieldChange(field.key, false)
                                    }
                                    className={`flex-1 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                                      currentVal === false
                                        ? "bg-rose-100 border-rose-400 text-rose-950"
                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                                    }`}
                                  >
                                    FALSE
                                  </button>
                                </div>
                              ) : field.type === "number" ? (
                                <input
                                  type="number"
                                  value={
                                    currentVal !== undefined ? currentVal : ""
                                  }
                                  onChange={(e) =>
                                    handleFieldChange(
                                      field.key,
                                      e.target.value === ""
                                        ? ""
                                        : Number(e.target.value),
                                    )
                                  }
                                  className="w-full px-2 py-0.5 rounded border border-slate-300 focus:outline-none text-[11px] bg-white text-slate-900 font-mono font-semibold text-right"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={
                                    currentVal !== undefined ? currentVal : ""
                                  }
                                  onChange={(e) =>
                                    handleFieldChange(field.key, e.target.value)
                                  }
                                  className="w-full px-2 py-0.5 rounded border border-slate-300 focus:outline-none text-[11px] bg-white text-slate-900 font-mono font-semibold"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col min-h-0 space-y-1">
                      <textarea
                        value={jsonText}
                        onChange={(e) => handleJsonTextChange(e.target.value)}
                        className="flex-1 w-full p-2 rounded bg-slate-900 text-emerald-400 text-[10px] font-mono focus:outline-none resize-none"
                      />
                      {jsonError && (
                        <div className="text-rose-600 text-[10px] bg-rose-50 p-1 rounded border border-rose-200">
                          ⚠️ {jsonError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Primary Run Test Simulation Button */}
                  <button
                    onClick={handleRunSimulation}
                    disabled={isExecuting || !!jsonError}
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0 mt-1"
                  >
                    {isExecuting ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    <span>
                      {isExecuting ? "Simulating..." : "Run Test Simulation"}
                    </span>
                  </button>
                </div>
              ) : (
                /* Step Sequence Tab View */
                <div className="space-y-1">
                  {stepRecords.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-[11px] bg-slate-50 border border-slate-200 rounded">
                      Click &quot;Run Test Simulation&quot; in Inputs tab to
                      execute steps.
                    </div>
                  ) : (
                    stepRecords.map(
                      (rec: StepEvaluationRecord, idx: number) => {
                        const isSelected = currentStepIndex === idx;
                        const cellRes = rec.cellResults?.[0];
                        const rObj = matrix.rows.find(
                          (r) => r.id === cellRes?.rowId,
                        );
                        const cObj = matrix.columns.find(
                          (c) => c.id === cellRes?.colId,
                        );
                        const stepLabel = `${cObj?.label || rec.colLabel || rec.colId} × ${rObj?.label || cellRes?.rowId || "Row"}`;
                        const mutCount = cellRes?.mutatedPayload
                          ? Object.keys(cellRes.mutatedPayload).length
                          : 0;

                        return (
                          <div
                            key={idx}
                            onClick={() =>
                              updateActiveTestCase((tc) => ({
                                ...tc,
                                currentStepIndex: idx,
                              }))
                            }
                            onMouseEnter={() => onHoverStepRecord(rec)}
                            onMouseLeave={() => onHoverStepRecord(undefined)}
                            className={`px-2 py-1.5 rounded border transition-colors cursor-pointer select-none flex items-center justify-between gap-2 ${
                              isSelected
                                ? "bg-slate-200/90 text-slate-900 border-slate-300 font-bold shadow-2xs"
                                : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            <div className="flex items-center space-x-1.5 min-w-0 truncate">
                              <span
                                className={`h-4 w-4 rounded text-[9px] flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? "bg-slate-800 text-white font-extrabold"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <span className="truncate">{stepLabel}</span>
                            </div>

                            <div className="flex items-center space-x-1 shrink-0">
                              {mutCount > 0 && (
                                <span
                                  className={`text-[9px] px-1 py-0.1 rounded font-bold ${
                                    isSelected
                                      ? "bg-slate-300/80 text-slate-900 border border-slate-400"
                                      : "bg-slate-100 text-slate-700 border border-slate-200"
                                  }`}
                                >
                                  +{mutCount}
                                </span>
                              )}
                              <ChevronRight
                                className={`h-3 w-3 ${isSelected ? "text-slate-800" : "text-slate-400"}`}
                              />
                            </div>
                          </div>
                        );
                      },
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Variable Inspector & Pinning */}
          <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 bg-slate-50 overflow-hidden">
            {/* Variable Search Bar */}
            <div className="p-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={varSearchQuery}
                  onChange={(e) => setVarSearchQuery(e.target.value)}
                  placeholder="Search variables by name or value..."
                  className="w-full pl-8 pr-3 py-1 rounded border border-slate-300 bg-slate-50 focus:bg-white text-[11px] text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder-slate-400 font-mono"
                />
              </div>

              <div className="text-[10px] text-slate-500 shrink-0 font-mono">
                Variables:{" "}
                <strong className="text-slate-800">
                  {allVariableEntries.length}
                </strong>
              </div>
            </div>

            {/* Variable List Body (Pinned + All) */}
            <div className="flex-1 p-2 space-y-4 overflow-y-auto min-h-0 font-mono">
              {/* Pinned Variables */}
              {pinnedVariables.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center space-x-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <Pin className="h-3 w-3 text-amber-500" />
                    <span>PINNED ({pinnedVariables.length})</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                    {pinnedVariables.map((item) => (
                      <div
                        key={`pinned_${item.key}`}
                        onMouseEnter={() => onHoverVariableKey?.(item.key)}
                        onMouseLeave={() => onHoverVariableKey?.(undefined)}
                        className="px-2.5 py-1.5 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-xs md:text-sm hover:border-amber-400 transition-colors shadow-2xs select-none min-w-0"
                      >
                        <div className="flex items-center space-x-1.5 min-w-0 flex-1 truncate">
                          <button
                            type="button"
                            onClick={() => handleTogglePin(item.key)}
                            title="Unpin Variable"
                            className="text-amber-600 hover:text-amber-800 cursor-pointer shrink-0"
                          >
                            <Pin className="h-3.5 w-3.5 fill-current" />
                          </button>
                          <span
                            className="font-bold text-slate-900 shrink-0 text-xs md:text-sm truncate"
                            title={item.key}
                          >
                            {item.key}
                          </span>
                          <span
                            className={`text-[10px] px-1 py-0.5 rounded font-bold shrink-0 ${item.isOutput ? "bg-amber-100/90 text-amber-950 border border-amber-300" : "bg-slate-100 text-slate-600 border border-slate-200"}`}
                          >
                            {item.isOutput ? "OUT" : "IN"}
                          </span>
                        </div>

                        {renderVariableValueBox(item.value, true)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unpinned / All Variables */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {pinnedVariables.length > 0
                    ? `OTHER VARIABLES (${unpinnedVariables.length})`
                    : `ALL VARIABLES (${unpinnedVariables.length})`}
                </div>

                {unpinnedVariables.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-xs bg-white border border-slate-200 rounded">
                    {varSearchQuery
                      ? `No variables matching "${varSearchQuery}"`
                      : "No variables recorded."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                    {unpinnedVariables.map((item) => (
                      <div
                        key={`unpinned_${item.key}`}
                        onMouseEnter={() => onHoverVariableKey?.(item.key)}
                        onMouseLeave={() => onHoverVariableKey?.(undefined)}
                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-xs md:text-sm hover:border-slate-400 transition-colors shadow-2xs select-none min-w-0"
                      >
                        <div className="flex items-center space-x-1.5 min-w-0 flex-1 truncate">
                          <button
                            type="button"
                            onClick={() => handleTogglePin(item.key)}
                            title="Pin Variable to Top"
                            className="text-slate-300 hover:text-amber-500 cursor-pointer shrink-0"
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                          <span
                            className="font-bold text-slate-900 shrink-0 text-xs md:text-sm truncate"
                            title={item.key}
                          >
                            {item.key}
                          </span>
                          <span
                            className={`text-[10px] px-1 py-0.5 rounded font-bold shrink-0 ${item.isOutput ? "bg-amber-100/80 text-amber-900 border border-amber-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}
                          >
                            {item.isOutput ? "OUT" : "IN"}
                          </span>
                        </div>

                        {renderVariableValueBox(item.value, false)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
