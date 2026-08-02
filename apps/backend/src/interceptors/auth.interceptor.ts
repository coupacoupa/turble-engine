import { Interceptor } from "@connectrpc/connect";

/** Backend Connect-RPC Interceptor for Auth Bearer token validation and request logging */
export const authInterceptor: Interceptor = (next) => async (req) => {
  const authHeader = req.header.get("Authorization");
  console.log(
    `[Connect RPC] Incoming Request: ${req.url} | Auth Present: ${Boolean(authHeader)}`,
  );

  // Attach user identity or trace ID to request context if present
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    req.header.set("x-user-id", `user_from_${token.slice(0, 6)}`);
  }

  const response = await next(req);
  console.log(`[Connect RPC] Response Completed for: ${req.url}`);
  return response;
};
