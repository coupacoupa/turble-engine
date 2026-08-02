import { CellActionItem, CellSchema } from "./matrix-schema";

/**
 * Normalizes a cell to its list of actions. Single source of truth — every
 * consumer (sheet rendering, dependency tracing, validation, evaluation) must
 * use this instead of reading `cell.actions` / `cell.action` directly.
 *
 * - Modern cells store `actions: CellActionItem[]`. That array is authoritative,
 *   INCLUDING when it is empty: the editor saves `[]` when a cell is emptied,
 *   and an emptied cell must not resurrect its legacy `action` field.
 * - Legacy cells only carry a single `action` + config on the cell itself;
 *   those are wrapped into a one-item list. `passthrough` means "no behavior"
 *   and yields an empty list.
 */
export function getCellActions(cell?: CellSchema | null): CellActionItem[] {
  if (!cell) return [];
  if (cell.actions) return cell.actions;
  if (!cell.action || cell.action === "passthrough") return [];

  return [
    {
      id: `act_${cell.id}`,
      order: 0,
      type: cell.action,
      enabled: cell.enabled ?? true,
      inputs: [],
      outputs: [],
      tableRuleConfig: cell.tableRuleConfig,
      expressionConfig: cell.expressionConfig,
      apiCallConfig: cell.apiCallConfig,
      eventEmitterConfig: cell.eventEmitterConfig,
      subWorkflowConfig: cell.subWorkflowConfig,
    },
  ];
}
