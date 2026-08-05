import React, { useEffect, useMemo } from "react";
import { DraggableModal } from "@/components/common/draggable-modal.component";
import {
  selectActiveAction,
  selectActiveActionIndex,
  useCellEditorStore,
} from "@/stores/cell-editor.store";
import {
  selectSelectedCell,
  selectSelectedCol,
  selectSelectedRow,
  useMatrixEditorStore,
} from "@/stores/matrix-editor.store";
import {
  CellActionType,
  CellSchema,
  MatrixSchema,
  SubWorkflowTriggerConfig,
} from "@/types/matrix.types";
import { getCellActions } from "@/utils/cell-actions.util";
import { parseJsonRecord } from "@/utils/json-record.util";
import { Save } from "lucide-react";
import { CellActionSequence } from "./cell-action-sequence/cell-action-sequence.component";
import { DecisionTableEditor } from "./decision-table/decision-table-editor.component";
import { ExpressionEditor } from "./expression-editor.component";
import { SubWorkflowEditor } from "./sub-workflow-editor.component";

export interface InputSourceOption {
  key: string;
  source: string;
  label: string;
}

interface CellEditorModalProps {
  availableSubWorkflows?: MatrixSchema[];
}

const DEFAULT_WIDTH = 780;
const DEFAULT_HEIGHT = 720;
const MIN_WIDTH = 500;
const MIN_HEIGHT = 400;

function getActionTypeLabel(type?: CellActionType): string {
  switch (type) {
    case "table_rule":
      return "Decision Table Rules";
    case "expression":
      return "Expression (TEL)";
    case "trigger_sub_workflow":
      return "Trigger Bound Sub-Workflow Matrix";
    case "override_sub_workflow":
      return "Sub-Workflow with Parameter Overrides";
    case "skip_sub_workflow":
      return "Skip Sub-Workflow Execution";
    default:
      return type || "";
  }
}

function getActionTypeBadgeStyle(type?: CellActionType): string {
  switch (type) {
    case "table_rule":
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    case "expression":
      return "bg-indigo-100 text-indigo-900 border-indigo-200";
    default:
      return "bg-purple-100 text-purple-900 border-purple-200";
  }
}

export const CellEditorModal: React.FC<CellEditorModalProps> = ({
  availableSubWorkflows = [],
}) => {
  const isOpen = useMatrixEditorStore((s) => s.activeModal === "cellEditor");
  const close = useMatrixEditorStore((s) => s.closeModal);
  const matrix = useMatrixEditorStore((s) => s.matrix);
  const saveCell = useMatrixEditorStore((s) => s.saveCell);

  const row = useMatrixEditorStore(selectSelectedRow);
  const column = useMatrixEditorStore(selectSelectedCol);
  const cell = useMatrixEditorStore(selectSelectedCell);

  const actions = useCellEditorStore((s) => s.actions);
  const activeAction = useCellEditorStore(selectActiveAction);
  const activeActionIndex = useCellEditorStore(selectActiveActionIndex);
  const inputSearchQuery = useCellEditorStore((s) => s.inputSearchQuery);
  const inputMappingStr = useCellEditorStore((s) => s.inputMappingStr);
  const outputMappingStr = useCellEditorStore((s) => s.outputMappingStr);

  const initializeFromCell = useCellEditorStore((s) => s.initializeFromCell);

  // Initialize draft sub-store when modal opens. Must run even when the cell
  // doesn't exist yet (empty coordinate) — otherwise the store keeps the
  // previously edited cell's draft and a new cell opens with stale state.
  useEffect(() => {
    if (isOpen) {
      initializeFromCell(cell);
    }
  }, [isOpen, cell, initializeFromCell]);

  const availableInputOptions = useMemo(() => {
    if (!matrix || !row || !column) return [];

    const options: InputSourceOption[] = [];
    const keysSeen = new Set<string>();

    const colOrderMap = new Map(
      (matrix.columns || []).map((c) => [c.id, c.order]),
    );
    const rowOrderMap = new Map(
      (matrix.rows || []).map((r) => [r.id, r.order]),
    );

    const currColOrder = colOrderMap.get(column.id) ?? 0;
    const currRowOrder = rowOrderMap.get(row.id) ?? 0;

    // 1. Preceding actions within the SAME cell
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

  const availableVarKeys = useMemo(
    () => availableInputOptions.map((o) => o.key),
    [availableInputOptions],
  );

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

  // Sub-workflow mapping validation, derived during render so the Save button
  // can block while invalid instead of silently dropping the user's JSON.
  const inputMappingResult = parseJsonRecord(inputMappingStr);
  const outputMappingResult = parseJsonRecord(outputMappingStr);
  const mappingError = isStandardRow
    ? undefined
    : inputMappingResult.error || outputMappingResult.error;

  const handleSave = () => {
    let nextActions = actions.map((a, idx) => ({ ...a, order: idx }));
    let subWorkflowConfig = actions[0]?.subWorkflowConfig;

    if (!isStandardRow) {
      if (mappingError) return;
      subWorkflowConfig = {
        ...cell?.subWorkflowConfig,
        inputMapping: inputMappingResult.value ?? {},
        outputMapping: outputMappingResult.value ?? {},
      } satisfies SubWorkflowTriggerConfig;

      const hasMappings =
        Object.keys(subWorkflowConfig.inputMapping).length > 0 ||
        Object.keys(subWorkflowConfig.outputMapping).length > 0;

      if (nextActions.length === 0 && hasMappings) {
        // Mappings were configured without an explicit action: persist them on
        // an implicit trigger action so saveCell's empty-cell pruning doesn't
        // discard the config.
        nextActions = [
          {
            id: `act_${Date.now()}_0`,
            order: 0,
            type: "trigger_sub_workflow",
            enabled: true,
            inputs: [],
            outputs: [],
            subWorkflowConfig,
          },
        ];
      } else {
        // A sub-workflow cell has one mapping editor, so the config is uniform
        // across its actions.
        nextActions = nextActions.map((a) => ({ ...a, subWorkflowConfig }));
      }
    }

    const updatedCell: CellSchema = {
      id: cell?.id || `${row.id}:${column.id}`,
      rowId: row.id,
      colId: column.id,
      actions: nextActions,
      enabled: cell?.enabled !== false,
      tableRuleConfig: nextActions[0]?.tableRuleConfig,
      expressionConfig: nextActions[0]?.expressionConfig,
      subWorkflowConfig,
    };

    saveCell(updatedCell);
    close();
  };

  const tag = `${column.label} × ${row.label}`;

  const renderActiveActionPanel = () => {
    if (!activeAction) return null;

    switch (activeAction.type) {
      case "table_rule":
        return (
          <DecisionTableEditor
            filteredInputOptions={filteredInputOptions}
            availableVarKeys={availableVarKeys}
          />
        );
      case "expression":
        return <ExpressionEditor availableVariables={availableVarKeys} />;
      default:
        return null;
    }
  };

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={close}
      title={
        <div className="flex items-center space-x-2">
          <span>Configure Cell Coordinate</span>
          <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-700 border border-slate-200">
            {tag}
          </span>
        </div>
      }
      defaultWidth={DEFAULT_WIDTH}
      defaultHeight={DEFAULT_HEIGHT}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
      footer={
        <div className="flex items-center justify-end space-x-3">
          {mappingError ? (
            <span className="text-[11px] font-mono text-rose-600 truncate max-w-md">
              ⚠️ Invalid mapping JSON: {mappingError}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={!!mappingError}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Cell Config</span>
          </button>
        </div>
      }
    >
      <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs bg-slate-50/50">
        <CellActionSequence isStandardRow={isStandardRow} />

        {actions.length > 0 && activeAction ? (
          <div className="flex items-center space-x-1.5 pt-1 px-1">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${getActionTypeBadgeStyle(
                activeAction.type,
              )}`}
            >
              #{activeActionIndex + 1} {getActionTypeLabel(activeAction.type)}
            </span>
          </div>
        ) : null}

        {isStandardRow ? (
          actions.length > 0 && activeAction ? (
            renderActiveActionPanel()
          ) : null
        ) : (
          <SubWorkflowEditor availableSubWorkflows={availableSubWorkflows} />
        )}
      </div>
    </DraggableModal>
  );
};
