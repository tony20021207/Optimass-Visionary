// Database config. Created once in Phase 0. Agents must never edit, overwrite or regenerate this file
// (denied in .claude/settings.json); ask Tony instead.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
