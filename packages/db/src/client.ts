import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Creates a Drizzle client. Server-only; reads DATABASE_URL unless a URL is passed. */
export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  return drizzle(postgres(url), { schema });
}

export type Db = ReturnType<typeof createDb>;
