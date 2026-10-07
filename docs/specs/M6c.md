# M6c: Diagnostics Tier 3: corrective prescriptions

- Lane: L4 (same agent as M6b)
- Location: `packages/diagnostics (tier3/)`
- Contracts: `@optimass/types`

## Inputs → outputs
`RootCauseHypothesis[]` + Tier 3 mappings → `CorrectivePrescription[]`; `diagnose()` assembles a `DiagnosticReport`

## Responsibilities
- Map hypotheses to correctives with dosage, using library exercise ids where possible.
- Assemble the full report with rule versions and disclaimers.

## Out of scope
- Adding correctives to a program (M10).

## Acceptance tests
- `diagnose()` output parses with `DiagnosticReport` (cross-tier references resolve).
- Each prescription references an existing hypothesis.
- Correctives that are library exercises carry `exerciseId`.

## Content Tony authors (TODO placeholders until then)
- TODO(Tony): Cause → corrective mappings and dosages (`content/rules/tier3`).

Done when `pnpm test`, `pnpm lint` and `pnpm typecheck` pass.
