import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.",
  );
}

const sql = neon(process.env.DATABASE_URL);

/** Drizzle client over the Neon serverless HTTP driver (Lambda/edge friendly). */
export const db = drizzle({ client: sql, schema });
