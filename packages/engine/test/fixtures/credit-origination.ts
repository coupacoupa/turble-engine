import { MatrixSchema } from "../../src";

/**
 * Mirror of the seed workflow in the web app (matrix.store.ts), with the
 * legacy raw-JS expression migrated to TEL and the sub-workflow row kept to
 * exercise the unsupported-action path.
 */
export const creditOriginationMatrix: MatrixSchema = {
  id: "wf_credit_origination",
  name: "Credit Risk Origination Engine",
  version: "1.0.0",
  columns: [
    { id: "col_ingest", label: "1. Application Ingest", order: 0 },
    { id: "col_audit", label: "2. Bureau & DTI Audit", order: 1 },
    { id: "col_underwrite", label: "3. Underwriting Decision", order: 2 },
  ],
  rows: [
    {
      id: "row_auth",
      label: "OAuth Security Guard",
      order: 0,
      type: "standard",
      isInterceptor: true,
    },
    {
      id: "row_bureau",
      label: "Credit Bureau Engine",
      order: 1,
      type: "standard",
    },
    {
      id: "row_notify",
      label: "Notification Hub",
      order: 2,
      type: "workflow",
      subWorkflowId: "wf_notification_sub",
    },
  ],
  cells: {
    "row_auth:col_ingest": {
      id: "cell_auth_ingest",
      rowId: "row_auth",
      colId: "col_ingest",
      action: "table_rule",
      tableRuleConfig: {
        rules: [
          {
            conditions: { token: "== valid" },
            mutations: { isAuthorized: true },
          },
        ],
      },
    },
    "row_bureau:col_audit": {
      id: "cell_bureau_audit",
      rowId: "row_bureau",
      colId: "col_audit",
      action: "table_rule",
      tableRuleConfig: {
        rules: [
          {
            conditions: { creditScore: ">= 700", dti: "<= 0.35" },
            mutations: { riskResult: "PASS_SCORECARD", maxLimit: 25000 },
            emitEvent: {
              eventName: "SCORECARD_APPROVED",
              payload: { tier: "GOLD" },
            },
          },
        ],
      },
    },
    "row_bureau:col_underwrite": {
      id: "cell_bureau_underwrite",
      rowId: "row_bureau",
      colId: "col_underwrite",
      action: "expression",
      expressionConfig: {
        expression: "riskResult == 'PASS_SCORECARD' ? 'APPROVED' : 'DECLINED'",
        outputVariable: "approvalStatus",
      },
    },
    "row_notify:col_underwrite": {
      id: "cell_notify_underwrite",
      rowId: "row_notify",
      colId: "col_underwrite",
      action: "trigger_sub_workflow",
      subWorkflowConfig: {
        inputMapping: { recipient: "applicantEmail", status: "approvalStatus" },
        outputMapping: { notificationStatus: "dispatchResult" },
      },
    },
  },
  inputs: [
    {
      id: "inp_1",
      key: "creditScore",
      type: "number",
      required: true,
      defaultValue: 720,
    },
    {
      id: "inp_2",
      key: "dti",
      type: "number",
      required: true,
      defaultValue: 0.3,
    },
    {
      id: "inp_3",
      key: "applicantEmail",
      type: "string",
      required: false,
      defaultValue: "applicant@example.com",
    },
    {
      id: "inp_4",
      key: "token",
      type: "string",
      required: false,
      defaultValue: "valid",
    },
  ],
};

export const approvedInput = {
  creditScore: 720,
  dti: 0.3,
  applicantEmail: "applicant@example.com",
  token: "valid",
};

export const declinedInput = {
  creditScore: 650,
  dti: 0.5,
  applicantEmail: "applicant@example.com",
  token: "valid",
};
