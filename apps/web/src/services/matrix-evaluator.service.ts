import { createPromiseClient } from '@connectrpc/connect';
import { connectTransport } from '@/api/transport';
import { MatrixEvaluatorService } from '@repo/proto';
import { ExecuteMatrixRequest, ExecuteMatrixResponse } from '@repo/proto';

/** Singleton Connect RPC client instance for MatrixEvaluatorService */
export const matrixEvaluatorClient = createPromiseClient(MatrixEvaluatorService, connectTransport);

export class MatrixEvaluatorConnectService {
  /** Execute matrix via backend Connect-RPC endpoint */
  static async executeMatrix(matrixId: string, initialPayload: Record<string, any>): Promise<ExecuteMatrixResponse> {
    const req = new ExecuteMatrixRequest({
      matrixId,
      initialPayloadJson: JSON.stringify(initialPayload),
    });
    return await matrixEvaluatorClient.executeMatrix(req);
  }
}

export type { ExecuteMatrixResponse };
