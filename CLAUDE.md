# OptiMass

Kinesiology-based hypertrophy planner and lifting technique analyzer.
Full plan: docs/plan.md (modules M0–M10, lanes L1–L4, phases).

## Stack
- pnpm workspaces monorepo. Next.js (App Router) + Tailwind CSS in apps/web. TypeScript everywhere.
- Zod schemas in packages/types are the single source of truth for cross-module data.
- MediaPipe Pose Landmarker (@mediapipe/tasks-vision) for pose estimation, run in a Web Worker.
- Vitest for unit tests.

## Hard rules
- NEVER overwrite, regenerate or edit the database config. If a change seems to need it, stop and ask Tony.
- Only edit folders owned by your lane (see "Lanes" in docs/plan.md). Read anything; write only your own folders.
- Do not edit packages/types, root package.json, pnpm-lock.yaml, apps/web/app/layout.tsx or the Tailwind preset
  unless you are working on main and Tony asked for a contracts change.
- Do not add dependencies from a lane. If one is needed, say so and stop.
- Biomechanics rules, thresholds, ratings and prescriptions live in content/ as data authored by Tony.
  Build engines that read that data. Never invent clinical values in code; use clearly marked placeholders.
- One module per session. Read the module's spec in docs/specs/ and its package CLAUDE.md first; do not explore the whole repo.

## Commands
- pnpm install · pnpm dev · pnpm test · pnpm lint · pnpm typecheck · pnpm build
- A task is done only when test, lint and typecheck all pass.

## Repo facts (Phase 0)
- Database config: `packages/db/drizzle.config.ts` (denied in .claude/settings.json). Postgres + Drizzle.
- Tailwind v4: the shared preset is `packages/ui/src/preset.css`, imported by `apps/web/app/globals.css`.
- Workspace packages are consumed as TypeScript source (no build step); apps/web lists them in `transpilePackages`.
- Shared fixtures: `@optimass/types/fixtures` (PoseFrame sequences, a DiagnosticReport). Regenerate with
  `pnpm --filter @optimass/types fixtures`.
