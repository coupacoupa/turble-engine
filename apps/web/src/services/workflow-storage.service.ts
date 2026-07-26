import { MatrixSchema } from '@/types/matrix.types';

const STORAGE_KEY = 'turble_engine_workflows_v1';

const SEED_WORKFLOW: MatrixSchema = {
  id: 'wf_credit_origination',
  name: 'Credit Origination 2D Matrix',
  description: 'Automated credit decisioning workflow spanning intake, risk scoring, underwriting, and approval.',
  version: '1.0.0',
  columns: [
    { id: 'col_intake', label: '1. Intake & Validation', order: 0 },
    { id: 'col_scoring', label: '2. Risk Scoring', order: 1 },
    { id: 'col_underwriting', label: '3. Underwriting Rule', order: 2 },
    { id: 'col_decision', label: '4. Final Decision', order: 3 },
  ],
  rows: [
    { id: 'row_applicant', label: 'Applicant Data Interceptor', order: 0, type: 'standard', isInterceptor: true },
    { id: 'row_bureau', label: 'Bureau Credit Scorecard', order: 1, type: 'standard' },
    { id: 'row_sub_kyc', label: 'KYC / AML Sub-Workflow', order: 2, type: 'workflow', subWorkflowId: 'wf_kyc_verification' },
    { id: 'row_limit', label: 'Credit Limit Calculator', order: 3, type: 'standard' },
  ],
  cells: {
    'row_applicant:col_intake': {
      id: 'c1',
      rowId: 'row_applicant',
      colId: 'col_intake',
      action: 'table_rule',
      enabled: true,
      tableRuleConfig: {
        rules: [
          {
            conditions: { age: '>= 18' },
            mutations: { isAdult: true, status: 'ELIGIBLE' },
          },
        ],
      },
    },
    'row_bureau:col_scoring': {
      id: 'c2',
      rowId: 'row_bureau',
      colId: 'col_scoring',
      action: 'expression',
      enabled: true,
      expressionConfig: {
        expression: 'creditScore >= 700 ? "TIER_1" : "TIER_2"',
        outputVariable: 'riskTier',
      },
    },
    'row_sub_kyc:col_underwriting': {
      id: 'c3',
      rowId: 'row_sub_kyc',
      colId: 'col_underwriting',
      action: 'trigger_sub_workflow',
      enabled: true,
      subWorkflowConfig: {
        inputMapping: { ssn: 'applicant_ssn' },
        outputMapping: { kycStatus: 'kyc_verification_result' },
      },
    },
  },
  inputs: [
    { id: 'inp_age', key: 'age', type: 'number', required: true, defaultValue: 28 },
    { id: 'inp_score', key: 'creditScore', type: 'number', required: true, defaultValue: 720 },
    { id: 'inp_ssn', key: 'applicant_ssn', type: 'string', required: true, defaultValue: '999-00-1234' },
  ],
};

export class WorkflowStorageService {
  /** Get all saved workflow matrices */
  public static getAll(): MatrixSchema[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([SEED_WORKFLOW]));
        return [SEED_WORKFLOW];
      }
      return JSON.parse(data);
    } catch {
      return [SEED_WORKFLOW];
    }
  }

  /** Get matrix by ID */
  public static getById(id: string): MatrixSchema | undefined {
    const all = this.getAll();
    return all.find((m) => m.id === id);
  }

  /** Save or update a matrix */
  public static save(matrix: MatrixSchema): void {
    if (typeof window === 'undefined') return;
    const all = this.getAll();
    const index = all.findIndex((m) => m.id === matrix.id);
    if (index >= 0) {
      all[index] = matrix;
    } else {
      all.unshift(matrix);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  /** Delete matrix by ID */
  public static delete(id: string): void {
    if (typeof window === 'undefined') return;
    const all = this.getAll().filter((m) => m.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}
