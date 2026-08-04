import type { Interceptor } from "@connectrpc/connect";
import { authClient } from "@/lib/auth-client";

/**
 * Frontend Connect-RPC Interceptor: attaches the Neon Auth session JWT as a
 * Bearer token so the backend can verify it against Neon's JWKS. Anonymous
 * when signed out.
 */
export const authInterceptor: Interceptor = (next) => async (req) => {
  try {
    const { data } = await authClient.getSession();
    const token = data?.session?.token;
    if (token) {
      req.header.set("Authorization", `Bearer ${token}`);
    }
  } catch {
    // No session — proceed anonymously.
  }
  req.header.set("x-client-version", "1.0.0");

  return await next(req);
};
