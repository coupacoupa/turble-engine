import {
  MatrixSchema,
  DomainRowSchema,
  StepColumnSchema,
  CellSchema,
  CellActionItem,
  TableRuleMatch,
  StepEvaluationRecord,
  CellResult,
  ReplayEventLog,
} from '@/types/matrix.types';
import { MatrixExecutionResult } from '@/services/matrix-evaluator.service';
import { getCellActions } from '@/utils/cell-actions.util';

/** Evaluate a single condition expression string against a runtime value */
function evaluateCondition(runtimeValue: any, conditionStr: string): boolean {
  if (conditionStr === undefined || conditionStr === null || conditionStr.trim() === '') {
    return true; // Empty condition means wildcard (always match)
  }

  const cond = conditionStr.trim();
  const val = runtimeValue;

  // Boolean evaluation
  if (cond.toLowerCase() === 'true') return val === true || val === 'true';
  if (cond.toLowerCase() === 'false') return val === false || val === 'false';

  // Numeric comparisons: >=, <=, >, <, !=, ==, =
  if (typeof val === 'number' || !isNaN(Number(val))) {
    const numVal = Number(val);

    if (cond.startsWith('>=')) {
      const target = Number(cond.slice(2).trim());
      return !isNaN(target) && numVal >= target;
    }
    if (cond.startsWith('<=')) {
      const target = Number(cond.slice(2).trim());
      return !isNaN(target) && numVal <= target;
    }
    if (cond.startsWith('>')) {
      const target = Number(cond.slice(1).trim());
      return !isNaN(target) && numVal > target;
    }
    if (cond.startsWith('<')) {
      const target = Number(cond.slice(1).trim());
      return !isNaN(target) && numVal < target;
    }
    if (cond.startsWith('!=') || cond.startsWith('<>')) {
      const target = Number(cond.slice(2).trim());
      return !isNaN(target) && numVal !== target;
    }
    if (cond.startsWith('==') || cond.startsWith('=')) {
      const targetStr = cond.replace(/^==?/, '').trim();
      const target = Number(targetStr);
      return !isNaN(target) ? numVal === target : String(val) === targetStr;
    }
  }

  // String equality / includes evaluation
  if (cond.startsWith('!=') || cond.startsWith('<>')) {
    const target = cond.slice(2).trim().replace(/^['"]|['"]$/g, '');
    return String(val).toLowerCase() !== target.toLowerCase();
  }

  if (cond.startsWith('==') || cond.startsWith('=')) {
    const target = cond.replace(/^==?/, '').trim().replace(/^['"]|['"]$/g, '');
    return String(val).toLowerCase() === target.toLowerCase();
  }

  // Direct string equality fallback
  const cleanCond = cond.replace(/^['"]|['"]$/g, '');
  return String(val).toLowerCase() === cleanCond.toLowerCase();
}

/** Local client-side matrix evaluator enforcing strict Column-by-Column, Row-by-Row evaluation order */
export class LocalMatrixEvaluatorService {
  static evaluateMatrix(matrix: MatrixSchema, initialPayload: Record<string, any>): MatrixExecutionResult {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startedAt = Date.now();

    // 1. Strict Sorting: Column by Column (outer loop)
    const sortedCols = [...matrix.columns].sort((a, b) => a.order - b.order);
    // 2. Strict Sorting: Row by Row (inner loop)
    const sortedRows = [...matrix.rows].sort((a, b) => a.order - b.order);

    let currentPayload = { ...initialPayload };
    const stepRecords: StepEvaluationRecord[] = [];
    let stepIndexCounter = 0;

    // Outer Loop: COLUMN by COLUMN
    for (const col of sortedCols) {
      // Inner Loop: ROW by ROW
      for (const row of sortedRows) {
        const cellKey = `${row.id}:${col.id}`;
        const cell = matrix.cells[cellKey];

        // Skip missing or disabled cells
        if (!cell || cell.enabled === false) continue;

        const cellStartTime = Date.now();
        const payloadBeforeCell = { ...currentPayload };
        const cellMutations: Record<string, any> = {};

        // Cell Actions Sequence
        const actionsList: CellActionItem[] = getCellActions(cell);

        for (const act of actionsList) {
          if (!act.enabled) continue;

          // Decision Table Rule Evaluation
          if (act.type === 'table_rule' && act.tableRuleConfig?.rules) {
            for (const rule of act.tableRuleConfig.rules) {
              const conditions = rule.conditions || {};

              // Check if all conditions match
              let allConditionsMatch = true;
              for (const [condKey, condValStr] of Object.entries(conditions)) {
                const runtimeVal = currentPayload[condKey];
                if (!evaluateCondition(runtimeVal, String(condValStr))) {
                  allConditionsMatch = false;
                  break;
                }
              }

              // Apply rule mutations if conditions matched
              if (allConditionsMatch && rule.mutations) {
                for (const [mutKey, mutVal] of Object.entries(rule.mutations)) {
                  let parsedVal: any = mutVal;
                  if (typeof mutVal === 'string') {
                    if (mutVal === 'true') parsedVal = true;
                    else if (mutVal === 'false') parsedVal = false;
                    else if (!isNaN(Number(mutVal)) && mutVal.trim() !== '') parsedVal = Number(mutVal);
                  }
                  currentPayload[mutKey] = parsedVal;
                  cellMutations[mutKey] = parsedVal;
                }
                break; // First matching rule wins
              }
            }
          }
        }

        const cellLatencyMs = Math.max(1, Date.now() - cellStartTime);

        const cellResult: CellResult = {
          cellId: cell.id,
          rowId: row.id,
          colId: col.id,
          action: cell.action || 'passthrough',
          status: 'success',
          mutatedPayload: cellMutations,
          latencyMs: cellLatencyMs,
        };

        const stepRecord: StepEvaluationRecord = {
          stepIndex: stepIndexCounter++,
          colId: col.id,
          colLabel: col.label,
          timestamp: Date.now(),
          initialPayload: payloadBeforeCell,
          finalPayload: { ...currentPayload },
          cellResults: [cellResult],
          emittedEvents: [],
        };

        stepRecords.push(stepRecord);
      }
    }

    const eventLog: ReplayEventLog = {
      executionId,
      matrixId: matrix.id,
      startedAt,
      completedAt: Date.now(),
      stepRecords,
    };

    return {
      executionId,
      matrixId: matrix.id,
      eventLog,
      finalPayload: currentPayload,
      hasErrors: false,
    };
  }
}
