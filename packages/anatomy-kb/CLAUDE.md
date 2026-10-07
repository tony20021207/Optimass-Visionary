# @optimass/anatomy-kb (M1)

Anatomy knowledge base: typed queries over muscles, joints and ROM norms authored in content/anatomy.

- Owner: lane L1 Planner logic. Only that lane edits this folder.
- Spec: docs/specs/M1.md
- Public API: everything exported from `src/index.ts` (stubs that throw until implemented).
- May import: `@optimass/types`. Nothing from apps/web or other lanes' packages not listed here.
- Tests: `pnpm --filter @optimass/anatomy-kb test`. Use fixtures from `@optimass/types/fixtures`, not live services.
- Clinical values (thresholds, weights, norms, dosages) come from content/, authored by Tony. Never hard-code them.
