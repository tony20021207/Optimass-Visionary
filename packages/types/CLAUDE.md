# @optimass/types (M0)

Zod schemas and inferred TypeScript types for every cross-module object. Single source of truth.

- Owner: main. Lanes read it and never edit it. Changes are a small contracts-only PR on main, then lanes `git merge main`.
- Public API: `@optimass/types` (schemas + types) and `@optimass/types/fixtures` (PoseSequence fixtures, a DiagnosticReport).
- May import: `zod` only.
- Fixtures: synthetic stick-figure poses from `scripts/generate-fixtures.mjs` (`pnpm --filter @optimass/types fixtures`).
  They exercise engines and UI; they are not recordings and not clinical references.
- Invariants enforced in schemas: PoseFrame has exactly 33 landmarks and world landmarks; every KinematicFinding has a
  requiredView; every RootCauseHypothesis has a screeningTest; a DiagnosticReport's findings match its camera view and
  its tier references resolve.
