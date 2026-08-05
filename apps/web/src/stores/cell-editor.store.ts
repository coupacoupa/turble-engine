import { create } from "zustand";
import {
  CellActionItem,
  CellActionType,
  CellSchema,
  TableRuleMatch,
} from "@/types/matrix.types";
import { getCellActions } from "@/utils/cell-actions.util";

export interface CellEditorState {
  // State
  actions: CellActionItem[];
  activeActionId: string;
  isAddDropdownOpen: boolean;

  inputSearchQuery: string;
  outputInputText: string;
  showInputDropdown: boolean;

  inputMappingStr: string;
  outputMappingStr: string;

  // Actions
  initializeFromCell: (cell?: CellSchema) => void;
  setActiveActionId: (id: string) => void;
  setIsAddDropdownOpen: (
    openOrUpdater: boolean | ((prev: boolean) => boolean),
  ) => void;

  addActionWithType: (type: CellActionType) => void;
  removeAction: (actionId: string) => void;
  moveAction: (index: number, direction: "up" | "down") => void;
  updateActiveAction: (
    updater: (act: CellActionItem) => CellActionItem,
  ) => void;

  addInputTag: (tag: string) => void;
  removeInputTag: (tag: string) => void;
  addOutputTag: (tag: string) => void;
  removeOutputTag: (tag: string) => void;

  addDecisionTableRow: () => void;
  removeDecisionTableRow: (idx: number) => void;
  setCellCondition: (ruleIdx: number, key: string, val: string) => void;
  setCellMutation: (ruleIdx: number, key: string, val: string) => void;

  setInputSearchQuery: (query: string) => void;
  setOutputInputText: (text: string) => void;
  setShowInputDropdown: (show: boolean) => void;
  setInputMappingStr: (val: string) => void;
  setOutputMappingStr: (val: string) => void;
}

// Single source of truth for "which action is being edited" — components must
// use this selector instead of re-implementing the find-or-first fallback.
export const selectActiveAction = (
  s: CellEditorState,
): CellActionItem | undefined =>
  s.actions.find((a) => a.id === s.activeActionId) || s.actions[0];

export const selectActiveActionIndex = (s: CellEditorState): number => {
  const active = selectActiveAction(s);
  return active ? s.actions.findIndex((a) => a.id === active.id) : -1;
};

/**
 * Drop rule conditions/mutations whose key has no matching input/output tag.
 * The rules grid only shows columns for current tags, but the engine evaluates
 * every stored condition — a stale entry left behind by a removed/renamed tag
 * silently makes its rule unmatchable.
 */
const pruneRuleEntries = (act: CellActionItem): CellActionItem => {
  if (act.type !== "table_rule" || !act.tableRuleConfig?.rules?.length) {
    return act;
  }
  const inputSet = new Set(act.inputs || []);
  const outputSet = new Set(act.outputs || []);
  return {
    ...act,
    tableRuleConfig: {
      ...act.tableRuleConfig,
      rules: act.tableRuleConfig.rules.map((rule) => ({
        ...rule,
        conditions: Object.fromEntries(
          Object.entries(rule.conditions || {}).filter(([k]) =>
            inputSet.has(k),
          ),
        ),
        mutations: Object.fromEntries(
          Object.entries(rule.mutations || {}).filter(([k]) =>
            outputSet.has(k),
          ),
        ),
      })),
    },
  };
};

export const useCellEditorStore = create<CellEditorState>((set, get) => ({
  actions: [],
  activeActionId: "",
  isAddDropdownOpen: false,

  inputSearchQuery: "",
  outputInputText: "",
  showInputDropdown: false,

  inputMappingStr: "{}",
  outputMappingStr: "{}",

  initializeFromCell: (cell) => {
    const cellActions = cell ? getCellActions(cell) : [];
    // Load existing sub-workflow mappings so reopening the editor shows what
    // was saved — every field the editor displays must round-trip.
    const swfConfig =
      cell?.subWorkflowConfig ||
      cellActions.find((a) => a.subWorkflowConfig)?.subWorkflowConfig;
    set({
      // Prune on load so the draft matches what the grid shows (and re-saving
      // heals cells persisted with stale rule entries).
      actions: cellActions.map(pruneRuleEntries),
      activeActionId: cellActions[0]?.id || "",
      isAddDropdownOpen: false,
      inputSearchQuery: "",
      outputInputText: "",
      showInputDropdown: false,
      inputMappingStr: JSON.stringify(swfConfig?.inputMapping ?? {}, null, 2),
      outputMappingStr: JSON.stringify(swfConfig?.outputMapping ?? {}, null, 2),
    });
  },

  setActiveActionId: (id) => set({ activeActionId: id }),

  setIsAddDropdownOpen: (openOrUpdater) =>
    set((state) => ({
      isAddDropdownOpen:
        typeof openOrUpdater === "function"
          ? openOrUpdater(state.isAddDropdownOpen)
          : openOrUpdater,
    })),

  addActionWithType: (type) =>
    set((state) => {
      const newAct: CellActionItem = {
        id: `act_${Date.now()}_${state.actions.length}`,
        order: state.actions.length,
        type,
        enabled: true,
        inputs: [],
        outputs: [],
        tableRuleConfig: { rules: [] },
      };
      return {
        actions: [...state.actions, newAct],
        activeActionId: newAct.id,
        isAddDropdownOpen: false,
      };
    }),

  removeAction: (actionId) =>
    set((state) => {
      const nextActions = state.actions
        .filter((a) => a.id !== actionId)
        .map((a, idx) => ({ ...a, order: idx }));
      const newActiveId =
        state.activeActionId === actionId
          ? nextActions[0]?.id || ""
          : state.activeActionId;
      return { actions: nextActions, activeActionId: newActiveId };
    }),

  moveAction: (index, direction) =>
    set((state) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= state.actions.length) return state;

      const next = [...state.actions];
      const temp = next[index]!;
      next[index] = next[targetIndex]!;
      next[targetIndex] = temp;

      const reordered = next.map((a, idx) => ({ ...a, order: idx }));
      return { actions: reordered };
    }),

  updateActiveAction: (updater) =>
    set((state) => {
      const activeId = state.activeActionId || state.actions[0]?.id;
      if (!activeId) return state;
      return {
        actions: state.actions.map((act) =>
          act.id === activeId ? updater(act) : act,
        ),
      };
    }),

  addInputTag: (tag) => {
    const clean = tag.trim();
    if (!clean) return;
    set((state) => {
      const activeId = state.activeActionId || state.actions[0]?.id;
      if (!activeId) return state;
      return {
        inputSearchQuery: "",
        actions: state.actions.map((act) => {
          if (act.id !== activeId) return act;
          const current = act.inputs || [];
          if (current.includes(clean)) return act;
          return { ...act, inputs: [...current, clean] };
        }),
      };
    });
  },

  removeInputTag: (tag) =>
    set((state) => {
      const activeId = state.activeActionId || state.actions[0]?.id;
      if (!activeId) return state;
      return {
        actions: state.actions.map((act) => {
          if (act.id !== activeId) return act;
          return pruneRuleEntries({
            ...act,
            inputs: (act.inputs || []).filter((i) => i !== tag),
          });
        }),
      };
    }),

  addOutputTag: (tag) => {
    const clean = tag.trim();
    if (!clean) return;
    set((state) => {
      const activeId = state.activeActionId || state.actions[0]?.id;
      if (!activeId) return state;
      return {
        outputInputText: "",
        actions: state.actions.map((act) => {
          if (act.id !== activeId) return act;
          const current = act.outputs || [];
          if (current.includes(clean)) return act;
          return { ...act, outputs: [...current, clean] };
        }),
      };
    });
  },

  removeOutputTag: (tag) =>
    set((state) => {
      const activeId = state.activeActionId || state.actions[0]?.id;
      if (!activeId) return state;
      return {
        actions: state.actions.map((act) => {
          if (act.id !== activeId) return act;
          return pruneRuleEntries({
            ...act,
            outputs: (act.outputs || []).filter((o) => o !== tag),
          });
        }),
      };
    }),

  addDecisionTableRow: () =>
    set((state) => {
      const activeId = state.activeActionId || state.actions[0]?.id;
      if (!activeId) return state;
      const newRule: TableRuleMatch = { conditions: {}, mutations: {} };
      return {
        actions: state.actions.map((act) => {
          if (act.id !== activeId) return act;
          return {
            ...act,
            tableRuleConfig: {
              ...act.tableRuleConfig,
              rules: [...(act.tableRuleConfig?.rules || []), newRule],
            },
          };
        }),
      };
    }),

  removeDecisionTableRow: (idx) =>
    set((state) => {
      const activeId = state.activeActionId || state.actions[0]?.id;
      if (!activeId) return state;
      return {
        actions: state.actions.map((act) => {
          if (act.id !== activeId) return act;
          const current = act.tableRuleConfig?.rules || [];
          return {
            ...act,
            tableRuleConfig: {
              ...act.tableRuleConfig,
              rules: current.filter((_, rIdx) => rIdx !== idx),
            },
          };
        }),
      };
    }),

  setCellCondition: (ruleIdx, key, val) =>
    set((state) => {
      const activeId = state.activeActionId || state.actions[0]?.id;
      if (!activeId) return state;
      return {
        actions: state.actions.map((act) => {
          if (act.id !== activeId) return act;
          const currentRules = [...(act.tableRuleConfig?.rules || [])];
          const targetRule = {
            ...(currentRules[ruleIdx] || { conditions: {}, mutations: {} }),
          };
          targetRule.conditions = { ...targetRule.conditions, [key]: val };
          currentRules[ruleIdx] = targetRule;
          return {
            ...act,
            tableRuleConfig: { ...act.tableRuleConfig, rules: currentRules },
          };
        }),
      };
    }),

  setCellMutation: (ruleIdx, key, val) =>
    set((state) => {
      const activeId = state.activeActionId || state.actions[0]?.id;
      if (!activeId) return state;
      return {
        actions: state.actions.map((act) => {
          if (act.id !== activeId) return act;
          const currentRules = [...(act.tableRuleConfig?.rules || [])];
          const targetRule = {
            ...(currentRules[ruleIdx] || { conditions: {}, mutations: {} }),
          };
          targetRule.mutations = { ...targetRule.mutations, [key]: val };
          currentRules[ruleIdx] = targetRule;
          return {
            ...act,
            tableRuleConfig: { ...act.tableRuleConfig, rules: currentRules },
          };
        }),
      };
    }),

  setInputSearchQuery: (query) => set({ inputSearchQuery: query }),
  setOutputInputText: (text) => set({ outputInputText: text }),
  setShowInputDropdown: (show) => set({ showInputDropdown: show }),
  setInputMappingStr: (val) => set({ inputMappingStr: val }),
  setOutputMappingStr: (val) => set({ outputMappingStr: val }),
}));
