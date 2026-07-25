import { CellSchema, CellResult, EmittedCellEvent, TableRuleMatch } from '../types/cell.types';
import { DomainRowSchema } from '../types/matrix.types';

export interface WorkflowSubRunner {
  runSubWorkflow: (
    subWorkflowId: string,
    inputPayload: Record<string, any>
  ) => Promise<{ finalPayload: Record<string, any>; events: EmittedCellEvent[] }>;
}

export class CellEvaluatorService {

  /** Evaluate a single cell given current row, cell schema, payload, and optional sub-workflow runner */
  public async evaluateCell(
    row: DomainRowSchema,
    cell: CellSchema | undefined,
    payload: Record<string, any>,
    subRunner?: WorkflowSubRunner
  ): Promise<CellResult> {
    const startTime = Date.now();
    const cellId = cell?.id ?? `${row.id}:unknown`;
    const rowId = row.id;
    const colId = cell?.colId ?? '';

    if (!cell || cell.enabled === false || cell.action === 'passthrough' || cell.action === 'skip_sub_workflow') {
      return {
        cellId,
        rowId,
        colId,
        action: cell?.action ?? 'passthrough',
        status: 'skipped',
        mutatedPayload: { ...payload },
        latencyMs: Date.now() - startTime,
      };
    }

    const mutatedPayload = { ...payload };
    const emittedEvents: EmittedCellEvent[] = [];
    const matchedRules: number[] = [];

    try {
      if (row.type === 'plain') {
        switch (cell.action) {
          case 'table_rule':
            if (cell.tableRuleConfig) {
              const rules = cell.tableRuleConfig.rules;
              const hitPolicy = cell.tableRuleConfig.hitPolicy ?? 'first_match';

              for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                if (rule && this.matchTableRule(rule, mutatedPayload)) {
                  matchedRules.push(i);
                  Object.assign(mutatedPayload, rule.mutations);

                  if (rule.emitEvent) {
                    emittedEvents.push({
                      eventName: rule.emitEvent.eventName,
                      rowId,
                      colId,
                      payload: rule.emitEvent.payload,
                      timestamp: Date.now(),
                    });
                  }

                  if (hitPolicy === 'first_match') break;
                }
              }
            }
            break;

          case 'expression':
            if (cell.expressionConfig) {
              const { expression, outputVariable } = cell.expressionConfig;
              const result = this.evaluateExpression(expression, mutatedPayload);
              mutatedPayload[outputVariable] = result;
            }
            break;

          case 'event_emitter':
            if (cell.eventEmitterConfig) {
              const { eventName, eventPayload } = cell.eventEmitterConfig;
              emittedEvents.push({
                eventName,
                rowId,
                colId,
                payload: eventPayload,
                timestamp: Date.now(),
              });
            }
            break;

          case 'api_call':
            if (cell.apiCallConfig) {
              // Simulated API call driver hook
              mutatedPayload[`_api_${cellId}_status`] = 200;
            }
            break;
        }
      } else if (row.type === 'workflow') {
        if ((cell.action === 'trigger_sub_workflow' || cell.action === 'override_sub_workflow') && row.subWorkflowId) {
          if (subRunner) {
            const config = cell.subWorkflowConfig;
            const subInput: Record<string, any> = {};

            // Map inputs
            if (config?.inputMapping) {
              for (const [subKey, parentKey] of Object.entries(config.inputMapping)) {
                subInput[subKey] = payload[parentKey];
              }
            } else {
              Object.assign(subInput, payload);
            }

            // Apply overrides
            if (config?.parameterOverrides) {
              Object.assign(subInput, config.parameterOverrides);
            }

            const subResult = await subRunner.runSubWorkflow(row.subWorkflowId, subInput);

            // Map outputs back
            if (config?.outputMapping) {
              for (const [parentKey, subKey] of Object.entries(config.outputMapping)) {
                mutatedPayload[parentKey] = subResult.finalPayload[subKey];
              }
            } else {
              Object.assign(mutatedPayload, subResult.finalPayload);
            }

            emittedEvents.push(...subResult.events);
          }
        }
      }

      return {
        cellId,
        rowId,
        colId,
        action: cell.action,
        status: 'success',
        mutatedPayload,
        emittedEvents,
        matchedRules,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        cellId,
        rowId,
        colId,
        action: cell.action,
        status: 'fail',
        mutatedPayload: { ...payload },
        error: err.message || String(err),
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /** Match a custom table rule against context payload */
  private matchTableRule(rule: TableRuleMatch, payload: Record<string, any>): boolean {
    for (const [varName, conditionStr] of Object.entries(rule.conditions)) {
      const val = payload[varName];
      if (!this.evaluateCondition(val, conditionStr)) {
        return false;
      }
    }
    return true;
  }

  /** Helper to evaluate condition operator expressions like ">= 700", "< 0.35", "== 'APPROVED'" */
  private evaluateCondition(actualVal: any, conditionStr: string): boolean {
    const trimmed = conditionStr.trim();
    if (trimmed.startsWith('>=')) {
      return Number(actualVal) >= Number(trimmed.slice(2).trim());
    }
    if (trimmed.startsWith('<=')) {
      return Number(actualVal) <= Number(trimmed.slice(2).trim());
    }
    if (trimmed.startsWith('>')) {
      return Number(actualVal) > Number(trimmed.slice(1).trim());
    }
    if (trimmed.startsWith('<')) {
      return Number(actualVal) < Number(trimmed.slice(1).trim());
    }
    if (trimmed.startsWith('==')) {
      return String(actualVal) === trimmed.slice(2).trim().replace(/^['"]|['"]$/g, '');
    }
    if (trimmed.startsWith('!=')) {
      return String(actualVal) !== trimmed.slice(2).trim().replace(/^['"]|['"]$/g, '');
    }
    // Default equality match
    return String(actualVal) === trimmed.replace(/^['"]|['"]$/g, '');
  }

  /** Helper to safely evaluate mathematical/logical expressions */
  private evaluateExpression(expr: string, payload: Record<string, any>): any {
    const keys = Object.keys(payload);
    const values = Object.values(payload);
    try {
      const fn = new Function('payload', ...keys, `return ${expr};`);
      return fn(payload, ...values);
    } catch {
      const fn = new Function('payload', `return ${expr};`);
      return fn(payload);
    }
  }
}
