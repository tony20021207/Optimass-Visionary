# @optimass/diagnostics (M6a/M6b/M6c)

Three-tier diagnostic engine: Tier 1 kinematic errors, Tier 2 ranked root-cause hypotheses with screening tests, Tier 3 correctives. Evaluates rule tables in content/rules.

- Owner: lane L4 Diagnostics. Only that lane edits this folder.
- Spec: docs/specs/M6a.md, docs/specs/M6b.md, docs/specs/M6c.md
- Public API: everything exported from `src/index.ts` (stubs that throw until implemented).
- May import: `@optimass/types`, `@optimass/anatomy-kb`, `@optimass/exercise-rating`. Nothing from apps/web or other lanes' packages not listed here.
- Tests: `pnpm --filter @optimass/diagnostics test`. Use fixtures from `@optimass/types/fixtures`, not live services.
- Clinical values (thresholds, weights, norms, dosages) come from content/, authored by Tony. Never hard-code them.

## Tier 2 (M6b), lat pulldown first
- Engine: `src/tier2/` (`schema.ts` = YAML shape, `infer.ts` = noisy-OR scoring + ranking). Data: `content/rules/tier2/<exerciseId>.yaml`.
- `parseTier2Rules` takes file texts (no fs), so the package stays browser-safe; put the result on `RuleSet.tier2`.
- Pulldown Tier 1 findings fixtures live in `src/tier2/fixtures` until Tier 1 emits real ones. Error codes they use are declared in the YAML's `errorCodes`.

## Set coaching (between-set feedback)
- `src/coaching/`: `coachSet` blends one set's Tier 1 findings, Tier 2 causes and the lifter's feedback (muscle feel 1-10, discomfort notes pinned to video moments) into cues. Data: `content/rules/coaching/<exerciseId>.yaml` (placeholders for Tony).
- `SetFeedback` is local to this package for now; move it to `@optimass/types` when feedback is persisted.
- UI: `apps/web/app/(analyzer)/analyzer/session` (3-set loop). It uses `pulldownSagittalFindings` as stand-in Tier 1 output until pose capture is connected.
