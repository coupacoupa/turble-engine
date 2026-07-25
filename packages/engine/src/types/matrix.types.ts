import { CellSchema } from './cell.types';

export type RowType = 'plain' | 'workflow';

export interface StepColumnSchema {
  id: string;
  label: string;
  order: number;
  isAsync?: boolean;
}

export interface DomainRowSchema {
  id: string;
  label: string;
  order: number;
  type: RowType;
  /** If type is 'workflow', this defines the sub-workflow matrix bound to this row */
  subWorkflowId?: string;
  /** If true, this row acts as a global interceptor executing on every column transition */
  isInterceptor?: boolean;
}

export interface MatrixSchema {
  id: string;
  name: string;
  description?: string;
  version: string;
  columns: StepColumnSchema[];
  rows: DomainRowSchema[];
  /** Matrix cell map keyed by `${rowId}:${colId}` */
  cells: Record<string, CellSchema>;
}
