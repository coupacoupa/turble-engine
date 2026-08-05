import { DraggableModal } from "@/components/common/draggable-modal.component";
import { WorkflowValidationService } from "@/services/workflow-validation.service";
import {
  CellActionItem,
  CellActionType,
  CellSchema,
  MatrixSchema,
  TableRuleMatch,
} from "@/types/matrix.types";
import { getCellActions } from "@/utils/cell-actions.util";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Layers,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

import {
  selectSelectedCell,
  selectSelectedCol,
  selectSelectedRow,
  useMatrixEditorStore,
} from "@/stores/matrix-editor.store";

interface CellEditorModalProps {
  availableSubWorkflows?: MatrixSchema[];
}

export interface InputSourceOption {
  key: string;
  source: string;
  label: string;
}

const DEFAULT_WIDTH = 780;
const DEFAULT_HEIGHT = 720;
const MIN_WIDTH = 500;
const MIN_HEIGHT = 480;

export const CellEditorModal: React.FC<CellEditorModalProps> = ({
  availableSubWorkflows = [],
}) => {
  const isOpen = useMatrixEditorStore((s) => s.activeModal === "cellEditor");
  const onClose = useMatrixEditorStore((s) => s.closeModal);
  const matrix = useMatrixEditorStore((s) => s.matrix);
  const row = useMatrixEditorStore(selectSelectedRow);
  const column = useMatrixEditorStore(selectSelectedCol);
  const cell = useMatrixEditorStore(selectSelectedCell);
  const onSaveCell = useMatrixEditorStore((s) => s.saveCell);
  const onSelectSubWorkflow = useMatrixEditorStore((s) => s.selectSubWorkflow);
  const onHoverInput = useMatrixEditorStore((s) => s.hoverInputKey);

  // Multi-action list state
  const [actions, setActions] = useState<CellActionItem[]>([]);
  const [activeActionId, setActiveActionId] = useState<string>("");
  const [cellEnabled, setCellEnabled] = useState(true);
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);

  // Sub-workflow JSON mapping state for sub-workflow rows
  const [inputMappingStr, setInputMappingStr] = useState("{}");
  const [outputMappingStr, setOutputMappingStr] = useState("{}");

  // Input search & autocomplete state
  const [inputSearchQuery, setInputSearchQuery] = useState("");
  const [showInputDropdown, setShowInputDropdown] = useState(false);
  const [outputInputText, setOutputInputText] = useState("");

  // Normalize cell actions when modal opens or selection changes
  useEffect(() => {
    if (!isOpen || !row || !column) return;

    setCellEnabled(cell?.enabled ?? true);

    let initialActions: CellActionItem[] = [];

    if (cell?.actions) {
      // Modern shape — authoritative even when empty (an emptied cell stays empty)
      initialActions = cell.actions.map((act, idx) => ({
        ...act,
        order: idx,
        inputs: act.inputs || [],
        outputs: act.outputs || [],
        tableRuleConfig: act.tableRuleConfig || { rules: [] },
      }));
    } else if (cell?.action && cell.action !== "passthrough") {
      // Legacy single action fallback migration
      initialActions = [
        {
          id: `act_${Date.now()}_0`,
          order: 0,
          type: row.type === "standard" ? "table_rule" : cell.action,
          enabled: cell.enabled ?? true,
          inputs: [],
          outputs: [],
          tableRuleConfig: cell.tableRuleConfig || { rules: [] },
          expressionConfig: cell.expressionConfig,
          subWorkflowConfig: cell.subWorkflowConfig,
        },
      ];
    } else {
      // Unconfigured empty cell starts with 0 actions until user clicks + Add Action
      initialActions = [];
    }

    setActions(initialActions);
    setActiveActionId(initialActions[0]?.id || "");

    // Initialize JSON mapping strings for subworkflow rows
    if (cell?.subWorkflowConfig) {
      setInputMappingStr(
        JSON.stringify(cell.subWorkflowConfig.inputMapping || {}, null, 2),
      );
      setOutputMappingStr(
        JSON.stringify(cell.subWorkflowConfig.outputMapping || {}, null, 2),
      );
    }
  }, [cell, row, column, isOpen]);

  // Active Action reference
  const activeActionIndex = useMemo(() => {
    return actions.findIndex((a) => a.id === activeActionId);
  }, [actions, activeActionId]);

  const activeAction = useMemo(() => {
    return actions[activeActionIndex] || actions[0];
  }, [actions, activeActionIndex]);

  // Resolve Available Inputs from Workflow Inputs and Preceding Cells (Prioritizing Preceding Cell Outputs)
  const availableInputOptions = useMemo<InputSourceOption[]>(() => {
    if (!matrix || !row || !column) return [];

    const options: InputSourceOption[] = [];
    const keysSeen = new Set<string>();

    // Map column & row order index maps
    const colOrderMap = new Map(matrix.columns.map((c) => [c.id, c.order]));
    const rowOrderMap = new Map(matrix.rows.map((r) => [r.id, r.order]));

    const currColOrder = column.order;
    const currRowOrder = row.order;

    // 1. Preceding Actions inside the current cell
    if (activeActionIndex > 0) {
      for (let i = 0; i < activeActionIndex; i++) {
        const prevAct = actions[i];
        (prevAct?.outputs || []).forEach((outKey) => {
          if (outKey && !keysSeen.has(outKey)) {
            keysSeen.add(outKey);
            options.push({
              key: outKey,
              source: `Action #${i + 1}`,
              label: `${outKey} (from Action #${i + 1})`,
            });
          }
        });
      }
    }

    // 2. Preceding Cells in Matrix Execution Order
    Object.values(matrix.cells || {}).forEach((otherCell) => {
      if (otherCell.rowId === row.id && otherCell.colId === column.id) return;

      const cOrder = colOrderMap.get(otherCell.colId);
      const rOrder = rowOrderMap.get(otherCell.rowId);

      if (cOrder === undefined || rOrder === undefined) return;

      const isPreceding =
        cOrder < currColOrder ||
        (cOrder === currColOrder && rOrder < currRowOrder);
      if (!isPreceding) return;

      const targetCol = matrix.columns.find((c) => c.id === otherCell.colId);
      const targetRow = matrix.rows.find((r) => r.id === otherCell.rowId);

      const cellLabel = `${targetCol?.label || otherCell.colId} × ${targetRow?.label || otherCell.rowId}`;

      const cellActions = getCellActions(otherCell);
      cellActions.forEach((act) => {
        (act.outputs || []).forEach((outKey) => {
          if (outKey && !keysSeen.has(outKey)) {
            keysSeen.add(outKey);
            options.push({
              key: outKey,
              source: `Cell: ${cellLabel}`,
              label: `${outKey} (from ${cellLabel})`,
            });
          }
        });
      });
    });

    // 3. Global Workflow Inputs (Fallback)
    if (matrix.inputs && matrix.inputs.length > 0) {
      matrix.inputs.forEach((inp) => {
        if (!keysSeen.has(inp.key)) {
          keysSeen.add(inp.key);
          options.push({
            key: inp.key,
            source: "Workflow Input",
            label: `${inp.key} (Workflow Input)`,
          });
        }
      });
    }

    return options;
  }, [matrix, row, column, actions, activeActionIndex]);

  // Filtered Input Options matching search query
  const filteredInputOptions = useMemo(() => {
    const query = inputSearchQuery.trim().toLowerCase();
    const activeInputs = activeAction?.inputs || [];
    return availableInputOptions.filter(
      (opt) =>
        !activeInputs.includes(opt.key) &&
        (opt.key.toLowerCase().includes(query) ||
          opt.source.toLowerCase().includes(query)),
    );
  }, [availableInputOptions, activeAction?.inputs, inputSearchQuery]);

  if (!isOpen || !row || !column) return null;

  const isStandardRow = row.type === "standard";

  // Multi-Action Management Handlers
  const handleAddAction = () => {
    handleAddActionWithType(
      isStandardRow ? "table_rule" : "trigger_sub_workflow",
    );
  };

  const handleAddActionWithType = (type: CellActionType) => {
    const newAct: CellActionItem = {
      id: `act_${Date.now()}_${actions.length}`,
      order: actions.length,
      type,
      enabled: true,
      inputs: [],
      outputs: [],
      tableRuleConfig: { rules: [] },
    };
    setActions((prev) => [...prev, newAct]);
    setActiveActionId(newAct.id);
    setIsAddDropdownOpen(false);
  };

  const handleRemoveAction = (actionId: string) => {
    const nextActions = actions
      .filter((a) => a.id !== actionId)
      .map((a, idx) => ({ ...a, order: idx }));
    setActions(nextActions);
    if (activeActionId === actionId) {
      setActiveActionId(nextActions[0]?.id || "");
    }
  };

  const handleClearAllCellActions = () => {
    if (!row || !column) return;
    const clearedCell: CellSchema = {
      id: cell?.id || `${row.id}:${column.id}`,
      rowId: row.id,
      colId: column.id,
      enabled: cellEnabled,
      action: "passthrough",
      actions: [],
    };
    onSaveCell(clearedCell);
    onClose();
  };

  const handleMoveAction = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= actions.length) return;

    const next = [...actions];
    const temp = next[index]!;
    next[index] = next[targetIdx]!;
    next[targetIdx] = temp;

    const reordered = next.map((a, idx) => ({ ...a, order: idx }));
    setActions(reordered);
  };

  const handleUpdateActiveAction = (
    updater: (act: CellActionItem) => CellActionItem,
  ) => {
    setActions((prev) =>
      prev.map((act) => (act.id === activeAction.id ? updater(act) : act)),
    );
  };

  // Tag Input Handlers for Inputs & Outputs
  const handleAddInputTag = (inputKey: string) => {
    const trimmed = inputKey.trim();
    if (!trimmed) return;

    handleUpdateActiveAction((act) => {
      const currentInputs = act.inputs || [];
      if (currentInputs.includes(trimmed)) return act;

      const newInputs = [...currentInputs, trimmed];
      // Automatically update table rule condition schemas
      const rules = act.tableRuleConfig?.rules || [];
      const updatedRules = rules.map((r) => ({
        ...r,
        conditions: {
          ...r.conditions,
          [trimmed]: r.conditions[trimmed] ?? "",
        },
      }));

      return {
        ...act,
        inputs: newInputs,
        tableRuleConfig: {
          ...act.tableRuleConfig,
          rules: updatedRules,
        },
      };
    });

    setInputSearchQuery("");
    setShowInputDropdown(false);
  };

  const handleRemoveInputTag = (inputKey: string) => {
    handleUpdateActiveAction((act) => {
      const newInputs = (act.inputs || []).filter((k) => k !== inputKey);
      const rules = act.tableRuleConfig?.rules || [];
      const updatedRules = rules.map((r) => {
        const nextConds = { ...r.conditions };
        delete nextConds[inputKey];
        return { ...r, conditions: nextConds };
      });

      return {
        ...act,
        inputs: newInputs,
        tableRuleConfig: { ...act.tableRuleConfig, rules: updatedRules },
      };
    });
  };

  const handleAddOutputTag = (outputKey: string) => {
    const trimmed = outputKey.trim();
    if (!trimmed) return;

    handleUpdateActiveAction((act) => {
      const currentOutputs = act.outputs || [];
      if (currentOutputs.includes(trimmed)) return act;

      const newOutputs = [...currentOutputs, trimmed];
      const rules = act.tableRuleConfig?.rules || [];
      const updatedRules = rules.map((r) => ({
        ...r,
        mutations: {
          ...r.mutations,
          [trimmed]: r.mutations[trimmed] ?? "",
        },
      }));

      return {
        ...act,
        outputs: newOutputs,
        tableRuleConfig: {
          ...act.tableRuleConfig,
          rules: updatedRules,
        },
      };
    });

    setOutputInputText("");
  };

  const handleRemoveOutputTag = (outputKey: string) => {
    handleUpdateActiveAction((act) => {
      const newOutputs = (act.outputs || []).filter((k) => k !== outputKey);
      const rules = act.tableRuleConfig?.rules || [];
      const updatedRules = rules.map((r) => {
        const nextMuts = { ...r.mutations };
        delete nextMuts[outputKey];
        return { ...r, mutations: nextMuts };
      });

      return {
        ...act,
        outputs: newOutputs,
        tableRuleConfig: { ...act.tableRuleConfig, rules: updatedRules },
      };
    });
  };

  // Decision Table Rule Row Handlers
  const handleAddDecisionTableRow = () => {
    handleUpdateActiveAction((act) => {
      const inputKeys = act.inputs || [];
      const outputKeys = act.outputs || [];

      const initialConds: Record<string, string> = {};
      inputKeys.forEach((k) => (initialConds[k] = ""));

      const initialMuts: Record<string, any> = {};
      outputKeys.forEach((k) => (initialMuts[k] = ""));

      const newRule: TableRuleMatch = {
        conditions: initialConds,
        mutations: initialMuts,
      };

      const existing = act.tableRuleConfig?.rules || [];
      return {
        ...act,
        tableRuleConfig: {
          ...act.tableRuleConfig,
          rules: [...existing, newRule],
        },
      };
    });
  };

  const handleRemoveDecisionTableRow = (ruleIdx: number) => {
    handleUpdateActiveAction((act) => {
      const existing = act.tableRuleConfig?.rules || [];
      return {
        ...act,
        tableRuleConfig: {
          ...act.tableRuleConfig,
          rules: existing.filter((_, idx) => idx !== ruleIdx),
        },
      };
    });
  };

  const handleCellConditionChange = (
    ruleIdx: number,
    inputKey: string,
    value: string,
  ) => {
    handleUpdateActiveAction((act) => {
      const rules = [...(act.tableRuleConfig?.rules || [])];
      if (rules[ruleIdx]) {
        rules[ruleIdx] = {
          ...rules[ruleIdx]!,
          conditions: {
            ...rules[ruleIdx]!.conditions,
            [inputKey]: value,
          },
        };
      }
      return {
        ...act,
        tableRuleConfig: { ...act.tableRuleConfig, rules },
      };
    });
  };

  const handleCellMutationChange = (
    ruleIdx: number,
    outputKey: string,
    value: string,
  ) => {
    handleUpdateActiveAction((act) => {
      const rules = [...(act.tableRuleConfig?.rules || [])];
      if (rules[ruleIdx]) {
        rules[ruleIdx] = {
          ...rules[ruleIdx]!,
          mutations: {
            ...rules[ruleIdx]!.mutations,
            [outputKey]: value,
          },
        };
      }
      return {
        ...act,
        tableRuleConfig: { ...act.tableRuleConfig, rules },
      };
    });
  };

  // Save Config Handler
  const handleSave = () => {
    let inputMapping: Record<string, string> = {};
    let outputMapping: Record<string, string> = {};
    try {
      inputMapping = JSON.parse(inputMappingStr);
      outputMapping = JSON.parse(outputMappingStr);
    } catch {
      // fallback
    }

    const updatedActions = actions.map((act) => {
      if (
        act.type === "trigger_sub_workflow" ||
        act.type === "override_sub_workflow"
      ) {
        return {
          ...act,
          subWorkflowConfig: { inputMapping, outputMapping },
        };
      }
      return act;
    });

    // With no actions left, the cell is saved as a passthrough so it renders (and validates) as empty
    const updatedCell: CellSchema = {
      id: cell?.id ?? `cell_${row.id}_${column.id}`,
      rowId: row.id,
      colId: column.id,
      action: updatedActions[0]?.type ?? "passthrough",
      actions: updatedActions,
      enabled: cellEnabled,
      tableRuleConfig: updatedActions[0]?.tableRuleConfig,
      subWorkflowConfig: updatedActions[0]?.subWorkflowConfig,
    };

    onSaveCell(updatedCell);
    onClose();
  };

  const inputKeys = activeAction?.inputs || [];
  const outputKeys = activeAction?.outputs || [];
  const rulesList = activeAction?.tableRuleConfig?.rules || [];

  return (
    <DraggableModal
      isOpen={isOpen && !!row && !!column}
      onClose={onClose}
      title="Configure Cell Coordinate"
      badge={row && column ? `${row.label} × ${column.label}` : undefined}
      defaultWidth={DEFAULT_WIDTH}
      defaultHeight={DEFAULT_HEIGHT}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
      footer={
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Cell Config</span>
          </button>
        </div>
      }
    >
      <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs bg-slate-50/50">
        {/* 1. Cell Actions Header & Dropdown Selector */}
        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-bold text-slate-800 text-xs">
              <Layers className="h-4 w-4 text-slate-500" />
              <span>Cell Action Sequence ({actions.length})</span>
            </div>

            {/* Dropdown Button: + New Cell Action */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAddDropdownOpen((prev) => !prev)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-mono text-xs flex items-center space-x-1.5 font-bold cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Cell Action</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${isAddDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Available Action Types Dropdown Menu */}
              {isAddDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-300 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 font-mono text-xs">
                  {isStandardRow ? (
                    <div
                      onClick={() => handleAddActionWithType("table_rule")}
                      className="p-3 hover:bg-emerald-50 cursor-pointer space-y-0.5 transition-colors"
                    >
                      <div className="font-bold text-emerald-950 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Decision Table</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans leading-tight">
                        Evaluate condition rules & set output variables
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        onClick={() =>
                          handleAddActionWithType("trigger_sub_workflow")
                        }
                        className="p-3 hover:bg-purple-50 cursor-pointer space-y-0.5 transition-colors"
                      >
                        <div className="font-bold text-purple-950 flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          <span>Trigger Bound Sub-Workflow</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans leading-tight">
                          Execute bound sub-workflow matrix
                        </div>
                      </div>
                      <div
                        onClick={() =>
                          handleAddActionWithType("override_sub_workflow")
                        }
                        className="p-3 hover:bg-purple-50 cursor-pointer space-y-0.5 transition-colors"
                      >
                        <div className="font-bold text-purple-950 flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-500" />
                          <span>Sub-Workflow with Parameter Overrides</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans leading-tight">
                          Pass custom override parameters
                        </div>
                      </div>
                      <div
                        onClick={() =>
                          handleAddActionWithType("skip_sub_workflow")
                        }
                        className="p-3 hover:bg-slate-100 cursor-pointer space-y-0.5 transition-colors"
                      >
                        <div className="font-bold text-slate-700 flex items-center space-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span>Skip Sub-Workflow Execution</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans leading-tight">
                          Bypass sub-workflow execution for this step
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cell Actions Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-2 px-3 w-10 text-center">#</th>
                  <th className="py-2 px-3">Action Type</th>
                  <th className="py-2 px-3">Inputs</th>
                  <th className="py-2 px-3">Outputs</th>
                  <th className="py-2 px-3">Rules / Details</th>
                  <th className="py-2 px-3 w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {actions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-5 text-center text-slate-400 text-xs font-sans"
                    >
                      No cell actions configured yet. Select{" "}
                      <strong className="text-emerald-700 font-mono">
                        + New Cell Action
                      </strong>{" "}
                      above to add one.
                    </td>
                  </tr>
                ) : (
                  actions.map((act, idx) => {
                    const isSelected = act.id === activeAction?.id;
                    const ruleCount = act.tableRuleConfig?.rules?.length || 0;

                    return (
                      <tr
                        key={act.id}
                        onClick={() => setActiveActionId(act.id)}
                        className={`cursor-pointer transition-colors relative ${
                          isSelected
                            ? "bg-emerald-50/90 text-slate-900 font-medium border-l-2 border-l-emerald-600 shadow-2xs"
                            : "hover:bg-slate-50/80 text-slate-700"
                        }`}
                      >
                        <td className="py-2 px-3 font-bold text-slate-400 text-center">
                          #{idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                              act.type === "table_rule"
                                ? "bg-slate-100 text-slate-800 border-slate-200"
                                : "bg-slate-100 text-slate-800 border-slate-200"
                            }`}
                          >
                            {act.type === "table_rule"
                              ? "Decision Table"
                              : act.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 truncate max-w-32.5">
                          {act.inputs && act.inputs.length > 0 ? (
                            <span className="text-emerald-700 font-bold">
                              {act.inputs.join(", ")}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="py-2 px-3 truncate max-w-32.5">
                          {act.outputs && act.outputs.length > 0 ? (
                            <span className="text-purple-700 font-bold">
                              {act.outputs.join(", ")}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">
                          {act.type === "table_rule"
                            ? `${ruleCount} rules`
                            : "Sub-Workflow Step"}
                        </td>
                        <td
                          className="py-2 px-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end space-x-1">
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleMoveAction(idx, "up")}
                                className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                                title="Move action up"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                            )}
                            {idx < actions.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleMoveAction(idx, "down")}
                                className="p-1 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                                title="Move action down"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveAction(act.id)}
                              className="p-1 hover:bg-rose-100 text-rose-600 rounded cursor-pointer"
                              title="Delete action"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Action Configuration Area */}
        {actions.length > 0 && activeAction && (
          <>
            {/* 2. Active Action Type Selector */}
            <div className="space-y-1.5 bg-white p-3 border border-slate-200 rounded-xl shadow-2xs">
              <label className="font-semibold text-slate-700 block text-xs">
                Action Type:
              </label>
              <select
                value={activeAction?.type || "table_rule"}
                onChange={(e) =>
                  handleUpdateActiveAction((act) => ({
                    ...act,
                    type: e.target.value as CellActionType,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-600 shadow-2xs"
              >
                {isStandardRow ? (
                  <option value="table_rule">Decision Table</option>
                ) : (
                  <>
                    <option value="trigger_sub_workflow">
                      Trigger Bound Sub-Workflow Matrix
                    </option>
                    <option value="override_sub_workflow">
                      Trigger Sub-Workflow with Parameter Overrides
                    </option>
                    <option value="skip_sub_workflow">
                      Skip Sub-Workflow for this Step
                    </option>
                  </>
                )}
              </select>
            </div>

            {/* 3. Standard Cell Action Interface (Inputs & Outputs Tag setup) */}
            {isStandardRow && activeAction?.type === "table_rule" && (
              <div className="space-y-4 bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
                {/* 3A. INPUTS Setup with Unified Tag Input & Autocomplete Dropdown */}
                <div className="space-y-1.5 relative">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>INPUTS (Condition Sources):</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Select workflow or preceding cell outputs
                    </span>
                  </div>

                  {/* Single Unified Tag Input Container */}
                  <div className="relative">
                    <div
                      onClick={() => {
                        const inputEl = document.getElementById(
                          `input-tag-search-${activeAction.id}`,
                        );
                        inputEl?.focus();
                      }}
                      className="flex flex-wrap gap-1.5 p-2 bg-white border border-slate-300 rounded-lg min-h-10.5 items-center focus-within:ring-1 focus-within:ring-slate-400 focus-within:border-slate-400 transition-all cursor-text shadow-2xs"
                    >
                      {/* Active Input Tag Chips */}
                      {inputKeys.map((key) => {
                        const isResolved =
                          matrix && row && column
                            ? WorkflowValidationService.isInputResolved(
                                key,
                                matrix,
                                row.id,
                                column.id,
                                activeActionIndex,
                              )
                            : true;

                        return (
                          <span
                            key={key}
                            onMouseEnter={() => onHoverInput?.(key)}
                            onMouseLeave={() => onHoverInput?.(null)}
                            title={
                              isResolved
                                ? "Resolved input source"
                                : "Unresolved input: missing from workflow inputs and preceding cell outputs"
                            }
                            className={`px-2 py-1 rounded font-mono text-[11px] flex items-center space-x-1 shadow-2xs font-bold transition-colors cursor-pointer ${
                              isResolved
                                ? "bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200"
                                : "bg-rose-100 text-rose-950 border border-rose-300 hover:bg-rose-200"
                            }`}
                          >
                            {!isResolved && (
                              <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
                            )}
                            <span>{key}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveInputTag(key);
                              }}
                              className={`p-0.5 rounded cursor-pointer ${
                                isResolved
                                  ? "text-slate-500 hover:text-slate-800"
                                  : "text-rose-700 hover:text-rose-950"
                              }`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}

                      {/* Inline Search Input */}
                      <input
                        id={`input-tag-search-${activeAction.id}`}
                        type="text"
                        value={inputSearchQuery}
                        onFocus={() => setShowInputDropdown(true)}
                        onChange={(e) => {
                          setInputSearchQuery(e.target.value);
                          setShowInputDropdown(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && inputSearchQuery.trim()) {
                            e.preventDefault();
                            handleAddInputTag(inputSearchQuery);
                          } else if (
                            e.key === "Backspace" &&
                            !inputSearchQuery &&
                            inputKeys.length > 0
                          ) {
                            handleRemoveInputTag(
                              inputKeys[inputKeys.length - 1]!,
                            );
                          }
                        }}
                        placeholder={
                          inputKeys.length === 0
                            ? "Search inputs or type & press Enter..."
                            : "Search or type & press Enter..."
                        }
                        className="flex-1 min-w-45 bg-transparent font-mono text-xs text-slate-900 focus:outline-none placeholder-slate-400 py-0.5"
                      />
                    </div>

                    {/* Autocomplete Dropdown Options */}
                    {showInputDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 font-mono text-xs">
                        {filteredInputOptions.length === 0 ? (
                          <div className="p-3 text-slate-400 text-center text-[11px]">
                            {inputSearchQuery ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleAddInputTag(inputSearchQuery)
                                }
                                className="text-emerald-600 hover:underline font-bold"
                              >
                                + Add custom input tag &quot;{inputSearchQuery}
                                &quot; (Press Enter)
                              </button>
                            ) : (
                              "No available preceding inputs found."
                            )}
                          </div>
                        ) : (
                          filteredInputOptions.map((opt) => (
                            <div
                              key={opt.key}
                              onMouseEnter={() => onHoverInput?.(opt.key)}
                              onMouseLeave={() => onHoverInput?.(null)}
                              onClick={() => handleAddInputTag(opt.key)}
                              className="px-3 py-2 hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition-colors"
                            >
                              <span className="font-bold text-slate-800">
                                {opt.key}
                              </span>
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {opt.source}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3B. OUTPUTS Setup with Unified Tag Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      <span>OUTPUTS (Cell Mutated Variables):</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Type variable names produced by this cell
                    </span>
                  </div>

                  {/* Single Unified Output Tag Input Container */}
                  <div
                    onClick={() => {
                      const outputEl = document.getElementById(
                        `output-tag-text-${activeAction.id}`,
                      );
                      outputEl?.focus();
                    }}
                    className="flex flex-wrap gap-1.5 p-2 bg-white border border-slate-300 rounded-lg min-h-10.5 items-center focus-within:ring-1 focus-within:ring-slate-400 focus-within:border-slate-400 transition-all cursor-text shadow-2xs"
                  >
                    {/* Active Output Tag Chips */}
                    {outputKeys.map((key) => {
                      const clashInfo =
                        matrix && row && column
                          ? WorkflowValidationService.isOutputClashing(
                              key,
                              matrix,
                              row.id,
                              column.id,
                              activeActionIndex,
                            )
                          : { clashing: false };

                      return (
                        <span
                          key={key}
                          title={
                            clashInfo.clashing
                              ? clashInfo.reason
                              : "Valid output key"
                          }
                          className={`px-2 py-1 rounded font-mono text-[11px] flex items-center space-x-1 shadow-2xs font-bold transition-colors cursor-pointer ${
                            clashInfo.clashing
                              ? "bg-rose-100 text-rose-950 border border-rose-300 hover:bg-rose-200"
                              : "bg-slate-100 text-slate-800 border border-slate-200"
                          }`}
                        >
                          {clashInfo.clashing && (
                            <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
                          )}
                          <span>{key}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveOutputTag(key);
                            }}
                            className={`p-0.5 rounded cursor-pointer ${
                              clashInfo.clashing
                                ? "text-rose-700 hover:text-rose-950"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}

                    {/* Inline Output Text Entry */}
                    <input
                      id={`output-tag-text-${activeAction.id}`}
                      type="text"
                      value={outputInputText}
                      onChange={(e) => setOutputInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          handleAddOutputTag(outputInputText);
                        } else if (
                          e.key === "Backspace" &&
                          !outputInputText &&
                          outputKeys.length > 0
                        ) {
                          handleRemoveOutputTag(
                            outputKeys[outputKeys.length - 1]!,
                          );
                        }
                      }}
                      placeholder={
                        outputKeys.length === 0
                          ? "Type output variable name & press Enter..."
                          : "Type output name & press Enter..."
                      }
                      className="flex-1 min-w-50 bg-transparent font-mono text-xs text-slate-900 focus:outline-none placeholder-slate-400 py-0.5"
                    />
                  </div>
                </div>

                {/* 3C. Dynamic Decision Table Grid */}
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-slate-500" />
                      <span className="font-bold text-slate-900 text-xs">
                        Decision Table Rules Matrix
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddDecisionTableRow}
                      className="px-2.5 py-1 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 font-mono text-[11px] flex items-center space-x-1 font-semibold cursor-pointer transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Rule Row</span>
                    </button>
                  </div>

                  {inputKeys.length === 0 && outputKeys.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono text-[11px] text-center">
                      Please add at least one INPUT or OUTPUT tag above to
                      populate Decision Table columns.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs bg-white">
                      <table className="w-full border-collapse font-mono text-[11px]">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                            <th className="p-2 border-r border-slate-200 text-center w-12 font-bold">
                              #
                            </th>

                            {/* Input Condition Columns */}
                            {inputKeys.map((inpKey) => (
                              <th
                                key={`head_in_${inpKey}`}
                                className="p-2 border-r border-slate-200 bg-slate-50 text-slate-800 text-left"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold">{inpKey}</span>
                                  <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded">
                                    IF
                                  </span>
                                </div>
                              </th>
                            ))}

                            {/* Output Mutation Columns */}
                            {outputKeys.map((outKey) => (
                              <th
                                key={`head_out_${outKey}`}
                                className="p-2 border-r border-slate-200 bg-slate-50 text-slate-800 text-left"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold">{outKey}</span>
                                  <span className="text-[9px] bg-slate-200 text-slate-700 px-1 rounded">
                                    SET
                                  </span>
                                </div>
                              </th>
                            ))}

                            <th className="p-2 text-center w-12 font-bold">
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200">
                          {rulesList.length === 0 ? (
                            <tr>
                              <td
                                colSpan={
                                  1 + inputKeys.length + outputKeys.length + 1
                                }
                                className="p-4 text-center text-slate-400 text-xs"
                              >
                                No rule rows configured yet. Click &quot;Add
                                Rule Row&quot; above.
                              </td>
                            </tr>
                          ) : (
                            rulesList.map((rule, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50/80">
                                <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-500">
                                  {rIdx + 1}
                                </td>

                                {/* Condition Cells */}
                                {inputKeys.map((inpKey) => (
                                  <td
                                    key={`cell_in_${rIdx}_${inpKey}`}
                                    className="p-1.5 border-r border-slate-200"
                                  >
                                    <input
                                      type="text"
                                      value={rule.conditions[inpKey] ?? ""}
                                      onChange={(e) =>
                                        handleCellConditionChange(
                                          rIdx,
                                          inpKey,
                                          e.target.value,
                                        )
                                      }
                                      placeholder="e.g. >= 700"
                                      className="w-full p-1 bg-white border border-slate-300 rounded text-slate-900 text-[11px] focus:outline-none focus:border-slate-500"
                                    />
                                  </td>
                                ))}

                                {/* Mutation Cells */}
                                {outputKeys.map((outKey) => (
                                  <td
                                    key={`cell_out_${rIdx}_${outKey}`}
                                    className="p-1.5 border-r border-slate-200"
                                  >
                                    <input
                                      type="text"
                                      value={rule.mutations[outKey] ?? ""}
                                      onChange={(e) =>
                                        handleCellMutationChange(
                                          rIdx,
                                          outKey,
                                          e.target.value,
                                        )
                                      }
                                      placeholder="e.g. APPROVED"
                                      className="w-full p-1 bg-white border border-slate-300 rounded text-slate-900 text-[11px] focus:outline-none focus:border-slate-500"
                                    />
                                  </td>
                                ))}

                                <td className="p-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveDecisionTableRow(rIdx)
                                    }
                                    className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded cursor-pointer"
                                    title="Delete rule row"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* 4. Sub-Workflow Configurations (for workflow rows) */}
        {!isStandardRow && (
          <div className="space-y-4 font-mono text-xs bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-purple-900 space-y-2">
              <span className="font-semibold text-xs">
                Target Sub-Workflow Matrix:
              </span>

              <select
                value={row.subWorkflowId || availableSubWorkflows[0]?.id || ""}
                onChange={(e) => onSelectSubWorkflow?.(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-white border border-purple-300 text-purple-950 font-mono text-xs focus:outline-none focus:border-purple-600"
              >
                {availableSubWorkflows.length > 0 ? (
                  availableSubWorkflows.map((wf) => (
                    <option key={wf.id} value={wf.id}>
                      {wf.name} ({wf.id})
                    </option>
                  ))
                ) : (
                  <option value="">No sub-workflows available</option>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">
                Input Mappings (JSON):
              </label>
              <textarea
                rows={3}
                value={inputMappingStr}
                onChange={(e) => setInputMappingStr(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-xs text-slate-800 focus:outline-none focus:border-purple-600"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">
                Output Mappings (JSON):
              </label>
              <textarea
                rows={3}
                value={outputMappingStr}
                onChange={(e) => setOutputMappingStr(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded font-mono text-xs text-slate-800 focus:outline-none focus:border-purple-600"
              />
            </div>
          </div>
        )}
      </div>
    </DraggableModal>
  );
};
