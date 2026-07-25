import { MatrixSchema } from '@turble/engine';

const STORAGE_KEY = 'turble_engine_workflows_v1';

export class WorkflowStorageService {
  /** Get all saved workflow matrices */
  public static getAll(): MatrixSchema[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
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
