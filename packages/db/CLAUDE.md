# @optimass/db (M0 stubs, then M9)

Postgres + Drizzle schema and client. Tables: users, programs, analysis_sessions (domain payloads as typed JSONB).

- Owner: lane L2 Planner UI & accounts. Schema changes are one owner at a time, never in two worktrees at once.
- NEVER edit, overwrite or regenerate `drizzle.config.ts` (the database config). It is denied in .claude/settings.json.
- Public API: `src/index.ts` (tables, row types, `createDb`). Server-only; never import from client components.
- May import: `@optimass/types`, `drizzle-orm`, `postgres`.
- Commands: `pnpm --filter @optimass/db db:generate` / `db:migrate` (needs DATABASE_URL, see .env.example).
