import type { Interceptor } from '@connectrpc/connect';

/** Frontend Connect-RPC Interceptor for Auth headers */
export const authInterceptor: Interceptor = (next) => async (req) => {
  // Inject Bearer token or telemetry headers
  req.header.set('Authorization', 'Bearer demo_token_turble_engine');
  req.header.set('x-client-version', '1.0.0');

  return await next(req);
};
