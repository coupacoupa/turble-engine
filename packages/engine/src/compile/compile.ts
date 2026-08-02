import { MatrixSchema } from "../schema/matrix-schema";
import { getCellActions } from "../schema/normalize";
import { coerceMutationValue, compileCondition } from "../lang/condition";
import { parseExpression } from "../lang/parser";
import { TelSyntaxError } from "../lang/errors";
import { toValue, Value } from "../lang/value";
import { Diagnostic } from "./diagnostics";
import {
  CompiledPlan,
  CompileResult,
  PlannedAction,
  PlannedCell,
  PlannedRule,
} from "./plan";

/** FNV-1a over a stable JSON representation — cheap content hash for plan caching. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const keys = Object.keys(v as object).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(",")}}`;
}

/** Deterministic ordering: by `order` asc, ties broken by id lexicographic. */
function sortByOrder<T extends { id: string; order: number }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

function coercePayloadObject(
  obj: Record<string, unknown> | undefined,
): Record<string, Value> {
  const out: Record<string, Value> = {};
  if (obj) {
    for (const [k, v] of Object.entries(obj)) out[k] = toValue(v);
  }
  return out;
}

/**
 * Compile a MatrixSchema into an executable plan.
 *
 * All parsing (condition shorthand, TEL expressions) and all static validation
 * (input resolution, output clashes) happens here, once — execution never
 * parses strings. Errors block execution; warnings ride along on the plan.
 */
export function compileMatrix(matrix: MatrixSchema): CompileResult {
  const diagnostics: Diagnostic[] = [];
  const warn = (d: Omit<Diagnostic, "severity">) =>
    diagnostics.push({ ...d, severity: "warning" });
  const error = (d: Omit<Diagnostic, "severity">) =>
    diagnostics.push({ ...d, severity: "error" });

  const columns = sortByOrder(matrix.columns ?? []);
  const rows = sortByOrder(matrix.rows ?? []);

  const workflowInputKeys = new Set((matrix.inputs ?? []).map((i) => i.key));

  /** Keys produced by cells already planned (execution order precedes current cell). */
  const producedKeys = new Set<string>();
  const cells: PlannedCell[] = [];

  for (let colIdx = 0; colIdx < columns.length; colIdx++) {
    const col = columns[colIdx]!;
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx]!;
      const cellKey = `${row.id}:${col.id}`;
      const cell = matrix.cells?.[cellKey];
      if (!cell) continue;

      const cellId = cell.id || cellKey;
      const disabled = cell.enabled === false;
      const actions = getCellActions(cell);
      const planned: PlannedAction[] = [];

      /** Keys produced by preceding enabled actions within this cell. */
      const cellLocalOutputs = new Set<string>();

      for (const act of sortByOrder(
        actions.map((a, i) => ({ ...a, order: a.order ?? i })),
      )) {
        const enabled = act.enabled !== false;
        const coord = {
          rowId: row.id,
          colId: col.id,
          cellId,
          actionId: act.id,
        };

        // Static dataflow validation (mirrors the editor's rules)
        for (const inputKey of act.inputs ?? []) {
          const resolved =
            workflowInputKeys.has(inputKey) ||
            producedKeys.has(inputKey) ||
            cellLocalOutputs.has(inputKey);
          if (!resolved) {
            warn({
              code: "UNRESOLVED_INPUT",
              message: `Input '${inputKey}' is not a workflow input and is not produced by any preceding cell or action`,
              ...coord,
              key: inputKey,
            });
          }
        }
        for (const outputKey of act.outputs ?? []) {
          if (workflowInputKeys.has(outputKey) || producedKeys.has(outputKey)) {
            warn({
              code: "OUTPUT_CLASH",
              message: `Output '${outputKey}' shadows a workflow input or a preceding cell's output`,
              ...coord,
              key: outputKey,
            });
          }
        }

        switch (act.type) {
          case "table_rule": {
            const rules: PlannedRule[] = [];
            const rawRules = act.tableRuleConfig?.rules ?? [];
            for (let ruleIdx = 0; ruleIdx < rawRules.length; ruleIdx++) {
              const rule = rawRules[ruleIdx]!;
              const conditions = Object.entries(rule.conditions ?? {}).map(
                ([key, cond]) => ({
                  key,
                  condition: compileCondition(cond == null ? "" : String(cond)),
                }),
              );
              const mutations = Object.entries(rule.mutations ?? {}).map(
                ([key, value]) => ({
                  key,
                  value: coerceMutationValue(value),
                }),
              );
              rules.push({
                conditions,
                mutations,
                emitEvent: rule.emitEvent
                  ? {
                      eventName: rule.emitEvent.eventName,
                      payload: coercePayloadObject(rule.emitEvent.payload),
                    }
                  : undefined,
              });
            }
            planned.push({
              kind: "table_rule",
              id: act.id,
              enabled,
              hitPolicy: act.tableRuleConfig?.hitPolicy ?? "first_match",
              rules,
            });
            break;
          }

          case "expression": {
            const source = act.expressionConfig?.expression ?? "";
            const outputVariable = act.expressionConfig?.outputVariable ?? "";
            if (!outputVariable) {
              error({
                code: "MISSING_EXPRESSION_OUTPUT",
                message: "Expression action has no output variable",
                ...coord,
              });
              break;
            }
            try {
              const ast = parseExpression(source);
              planned.push({
                kind: "expression",
                id: act.id,
                enabled,
                source,
                ast,
                outputVariable,
              });
              cellLocalOutputs.add(outputVariable);
            } catch (e) {
              // Best-effort migration of legacy raw-JS expressions
              // (`payload.x === 'y'`) into TEL before giving up.
              const migrated = source
                .replace(/\bpayload\./g, "")
                .replace(/===/g, "==")
                .replace(/!==/g, "!=");
              let migratedAst;
              try {
                migratedAst =
                  migrated !== source ? parseExpression(migrated) : undefined;
              } catch {
                migratedAst = undefined;
              }
              if (migratedAst) {
                warn({
                  code: "LEGACY_EXPRESSION_MIGRATED",
                  message: `Legacy JS expression '${source}' was auto-migrated to TEL as '${migrated}'`,
                  ...coord,
                });
                planned.push({
                  kind: "expression",
                  id: act.id,
                  enabled,
                  source: migrated,
                  ast: migratedAst,
                  outputVariable,
                });
                cellLocalOutputs.add(outputVariable);
                break;
              }
              const pos =
                e instanceof TelSyntaxError ? ` at position ${e.pos}` : "";
              error({
                code: "BAD_EXPRESSION_SYNTAX",
                message: `Invalid expression '${source}'${pos}: ${(e as Error).message}`,
                ...coord,
              });
            }
            break;
          }

          case "event_emitter": {
            planned.push({
              kind: "event_emitter",
              id: act.id,
              enabled,
              eventName: act.eventEmitterConfig?.eventName ?? "event",
              payload: coercePayloadObject(
                act.eventEmitterConfig?.eventPayload,
              ),
            });
            break;
          }

          case "passthrough":
            break;

          default: {
            // api_call and sub-workflow actions land in Phase 2 — planned as
            // visible skips so the log shows exactly what did not run.
            warn({
              code: "UNSUPPORTED_ACTION",
              message: `Action type '${act.type}' is not executable yet and will be skipped`,
              ...coord,
            });
            planned.push({
              kind: "unsupported",
              id: act.id,
              enabled,
              type: act.type,
            });
            break;
          }
        }

        if (enabled) {
          for (const outputKey of act.outputs ?? [])
            cellLocalOutputs.add(outputKey);
        }
      }

      // Only after the whole cell is planned do its outputs become visible to
      // later cells (execution-order semantics).
      if (!disabled) {
        for (const key of cellLocalOutputs) producedKeys.add(key);
        for (const a of planned) {
          if (a.kind === "table_rule" && a.enabled) {
            for (const r of a.rules)
              for (const m of r.mutations) producedKeys.add(m.key);
          }
        }
      }

      cells.push({
        cellId,
        rowId: row.id,
        colId: col.id,
        rowIdx,
        colIdx,
        disabled,
        actions: planned,
      });
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === "error");
  if (hasErrors) {
    return { diagnostics };
  }

  const plan: CompiledPlan = {
    matrixId: matrix.id,
    matrixVersion: matrix.version,
    planHash: fnv1a(
      stableStringify({
        id: matrix.id,
        columns,
        rows,
        cells: matrix.cells,
        inputs: matrix.inputs,
      }),
    ),
    columns: columns.map((c) => ({ id: c.id, label: c.label })),
    rows: rows.map((r) => ({ id: r.id, label: r.label, type: r.type })),
    cells,
    warnings: diagnostics,
  };

  return { plan, diagnostics };
}
