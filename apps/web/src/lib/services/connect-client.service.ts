import { createPromiseClient, Interceptor } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { createValidator } from '@bufbuild/protovalidate';

// Import generated Connect service & types from @repo/proto workspace package
import { MatrixEvaluatorService, ExecuteMatrixRequestSchema, type ExecuteMatrixRequest } from '@repo/proto';

const validator = createValidator();

/** Connect-RPC Client Interceptor that automatically validates requests using protovalidate */
const validationInterceptor: Interceptor = (next) => async (req) => {
  if (req.message) {
    const result = validator.validate(req.message as any, ExecuteMatrixRequestSchema as any);
    if (result.violations && result.violations.length > 0) {
      console.warn('[protovalidate] Schema validation violations detected:', result.violations);
    }
  }
  return await next(req);
};

// Create high-performance HTTP/2 / Connect web transport
export const connectTransport = createConnectTransport({
  baseUrl: 'http://localhost:8080',
  interceptors: [validationInterceptor],
});

// Create strongly-typed promise client for MatrixEvaluatorService
export const matrixEvaluatorClient = createPromiseClient(MatrixEvaluatorService, connectTransport);

export type { ExecuteMatrixRequest };
export { validator };
