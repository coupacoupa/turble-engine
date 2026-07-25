import { Interceptor } from '@connectrpc/connect';
import { createValidator } from '@bufbuild/protovalidate';

const validator = createValidator();

/** Frontend Connect-RPC Interceptor for Auth headers and schema validation */
export const authInterceptor: Interceptor = (next) => async (req) => {
  // Inject Bearer token or telemetry headers
  req.header.set('Authorization', 'Bearer demo_token_turble_engine');
  req.header.set('x-client-version', '1.0.0');

  if (req.message) {
    const result = validator.validate(req.message as any, req.method.I as any);
    if (result.violations && result.violations.length > 0) {
      console.warn('[protovalidate] Client schema validation violations detected:', result.violations);
    }
  }

  return await next(req);
};
