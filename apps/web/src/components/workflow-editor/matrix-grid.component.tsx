import React from 'react';
import { MatrixSchema, DomainRowSchema, StepColumnSchema, RowType, CellSchema } from '@/types/matrix.types';
import { MatrixSheet } from './matrix-sheet.component';

interface MatrixGridProps {
  matrix: MatrixSchema;
  activeStepIndex?: number;
  activeCellId?: string;
  onSelectCell: (row: DomainRowSchema, col: StepColumnSchema, cell?: CellSchema) => void;
  onAddColumn: () => void;
  onAddRow: (type: RowType) => void;
  onToggleInterceptor: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onDeleteColumn: (colId: string) => void;
}

export const MatrixGrid: React.FC<MatrixGridProps> = (props) => {
  return <MatrixSheet {...props} />;
};

export { MatrixSheet };
