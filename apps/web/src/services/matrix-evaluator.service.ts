import { createClient } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { connectTransport } from '@/api/transport';
import {
  MatrixEvaluatorService,
  type ExecuteMatrixResponse,
  ExecuteMatrixRequestSchema,
} from '@repo/proto';

/** Singleton Connect RPC client instance for MatrixEvaluatorService */
export const matrixEvaluatorClient = createClient(MatrixEvaluatorService, connectTransport);

export class MatrixEvaluatorConnectService {
  /** Execute matrix via backend Connect-RPC endpoint */
  static async executeMatrix(matrixId: string, initialPayload: Record<string, any>): Promise<ExecuteMatrixResponse> {
    return await matrixEvaluatorClient.executeMatrix(
      create(ExecuteMatrixRequestSchema, {
        matrixId,
        initialPayloadJson: JSON.stringify(initialPayload),
      }),
    );
  }
}

export type { ExecuteMatrixResponse };
