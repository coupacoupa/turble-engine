import { createAuthClient } from "@neondatabase/neon-js/auth";

const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;

if (!NEON_AUTH_URL) {
  console.warn(
    "[Auth] VITE_NEON_AUTH_URL is not set — copy .env.example to .env and " +
      "paste the Auth Base URL from the Neon Console (Project → Auth).",
  );
}

/**
 * Neon Auth (Managed Better Auth) client — sign-up/sign-in/session against
 * the hosted endpoints; auth data lives in our own Neon Postgres.
 */
export const authClient = createAuthClient(NEON_AUTH_URL ?? "");
