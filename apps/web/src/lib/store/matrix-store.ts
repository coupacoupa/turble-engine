import { MatrixSchema } from '@/types/matrix.types';

// Initial Starter Workflows
export const INITIAL_WORKFLOWS: MatrixSchema[] = [
  {
    id: 'wf_credit_origination',
    name: 'Credit Risk Origination Engine',
    description: '2D Scoring Matrix combining bureau credit audit, DTI capacity checks, and WhatsApp/Email dispatch.',
    version: '1.0.0',
    columns: [
      { id: 'col_ingest', label: '1. Application Ingest', order: 0 },
      { id: 'col_audit', label: '2. Bureau & DTI Audit', order: 1 },
      { id: 'col_underwrite', label: '3. Underwriting Decision', order: 2 },
    ],
    rows: [
      { id: 'row_auth', label: 'OAuth Security Guard', order: 0, type: 'plain', isInterceptor: true },
      { id: 'row_bureau', label: 'Credit Bureau Engine', order: 1, type: 'plain' },
      { id: 'row_notify', label: 'Notification Hub', order: 2, type: 'workflow', subWorkflowId: 'wf_notification_sub' },
    ],
    cells: {
      'row_auth:col_ingest': {
        id: 'cell_auth_ingest',
        rowId: 'row_auth',
        colId: 'col_ingest',
        action: 'table_rule',
        tableRuleConfig: {
          rules: [
            {
              conditions: { token: '== valid' },
              mutations: { isAuthorized: true },
            },
          ],
        },
      },
      'row_bureau:col_audit': {
        id: 'cell_bureau_audit',
        rowId: 'row_bureau',
        colId: 'col_audit',
        action: 'table_rule',
        tableRuleConfig: {
          rules: [
            {
              conditions: { creditScore: '>= 700', dti: '<= 0.35' },
              mutations: { riskResult: 'PASS_SCORECARD', maxLimit: 25000 },
              emitEvent: { eventName: 'SCORECARD_APPROVED', payload: { tier: 'GOLD' } },
            },
          ],
        },
      },
      'row_bureau:col_underwrite': {
        id: 'cell_bureau_underwrite',
        rowId: 'row_bureau',
        colId: 'col_underwrite',
        action: 'expression',
        expressionConfig: {
          expression: "payload.riskResult === 'PASS_SCORECARD' ? 'APPROVED' : 'DECLINED'",
          outputVariable: 'approvalStatus',
        },
      },
      'row_notify:col_underwrite': {
        id: 'cell_notify_underwrite',
        rowId: 'row_notify',
        colId: 'col_underwrite',
        action: 'trigger_sub_workflow',
        subWorkflowConfig: {
          inputMapping: { recipient: 'applicantEmail', status: 'approvalStatus' },
          outputMapping: { notificationStatus: 'dispatchResult' },
        },
      },
    },
  },
  {
    id: 'wf_notification_sub',
    name: 'Notification Dispatch Capability',
    description: 'Sub-workflow capability for sending WhatsApp and Email receipts.',
    version: '1.0.0',
    columns: [
      { id: 'sub_col_1', label: '1. Build Payload', order: 0 },
      { id: 'sub_col_2', label: '2. Send Webhook', order: 1 },
    ],
    rows: [
      { id: 'sub_row_email', label: 'Email Driver', order: 0, type: 'plain' },
    ],
    cells: {
      'sub_row_email:sub_col_1': {
        id: 'sub_cell_1',
        rowId: 'sub_row_email',
        colId: 'sub_col_1',
        action: 'expression',
        expressionConfig: {
          expression: "'EMAIL_SENT_SUCCESS'",
          outputVariable: 'dispatchResult',
        },
      },
    },
  },
];
