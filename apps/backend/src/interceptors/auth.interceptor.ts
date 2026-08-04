import {
  Code,
  ConnectError,
  createContextKey,
  Interceptor,
} from "@connectrpc/connect";
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AuthUser {
  id: string;
  email?: string;
}

/** Authenticated user for the current RPC — set by authInterceptor, read via ctx.values.get(kUser). */
export const kUser = createContextKey<AuthUser | undefined>(undefined, {
  description: "Neon Auth authenticated user",
});

const NEON_AUTH_URL = process.env.NEON_AUTH_URL;
if (!NEON_AUTH_URL) {
  throw new Error(
    "NEON_AUTH_URL is not set — copy apps/backend/.env.example to .env and paste the Auth Base URL from the Neon Console.",
  );
}

// Neon Auth public keys — fetched once and cached by jose, so verification
// is a local signature check with no per-request network call.
const jwks = createRemoteJWKSet(
  new URL(`${NEON_AUTH_URL}/.well-known/jwks.json`),
);
const issuer = new URL(NEON_AUTH_URL).origin;

/** Verifies the Neon Auth session JWT and exposes the user to handlers. */
export const authInterceptor: Interceptor = (next) => async (req) => {
  const token = req.header.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) {
    throw new ConnectError("authentication required", Code.Unauthenticated);
  }

  let sub: string | undefined;
  let email: unknown;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer });
    sub = payload.sub;
    email = payload.email;
  } catch {
    throw new ConnectError("invalid or expired token", Code.Unauthenticated);
  }
  if (!sub) {
    throw new ConnectError("token missing subject", Code.Unauthenticated);
  }

  req.contextValues.set(kUser, {
    id: sub,
    email: typeof email === "string" ? email : undefined,
  });
  return next(req);
};
