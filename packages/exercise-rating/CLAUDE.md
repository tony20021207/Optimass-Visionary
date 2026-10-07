# @optimass/exercise-rating (M2)

Exercise rating engine: scores an exercise for a target muscle using the weighted rubric in content/rating.

- Owner: lane L1 Planner logic. Only that lane edits this folder.
- Spec: docs/specs/M2.md
- Public API: everything exported from `src/index.ts` (stubs that throw until implemented).
- May import: `@optimass/types`, `@optimass/anatomy-kb`. Nothing from apps/web or other lanes' packages not listed here.
- Tests: `pnpm --filter @optimass/exercise-rating test`. Use fixtures from `@optimass/types/fixtures`, not live services.
- Clinical values (thresholds, weights, norms, dosages) come from content/, authored by Tony. Never hard-code them.
