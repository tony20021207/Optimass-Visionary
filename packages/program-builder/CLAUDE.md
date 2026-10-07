# @optimass/program-builder (M3)

Program builder: volume landmarks, split generation, exercise selection from M2 ratings, progression and deloads.

- Owner: lane L1 Planner logic. Only that lane edits this folder.
- Spec: docs/specs/M3.md
- Public API: everything exported from `src/index.ts` (stubs that throw until implemented).
- May import: `@optimass/types`, `@optimass/anatomy-kb`, `@optimass/exercise-rating`. Nothing from apps/web or other lanes' packages not listed here.
- Tests: `pnpm --filter @optimass/program-builder test`. Use fixtures from `@optimass/types/fixtures`, not live services.
- Clinical values (thresholds, weights, norms, dosages) come from content/, authored by Tony. Never hard-code them.
