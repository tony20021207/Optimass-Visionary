# M6b: Diagnostics Tier 2: anatomical root causes

- Lane: L4 (same agent as M6c)
- Location: `packages/diagnostics (tier2/)`
- Contracts: `@optimass/types`

## Inputs → outputs
`KinematicFinding[]` + Tier 2 mappings + `AnatomyKb` → ranked `RootCauseHypothesis[]`

## Responsibilities
- Map finding patterns to candidate causes (mobility, motor control, strength, …).
- Rank by likelihood; attach the confirming screening test to each.
- Output hypotheses, never diagnoses.

## Out of scope
- Correctives (M6c).

## Acceptance tests
- Every hypothesis has a screening test and references existing findings.
- Combined findings (e.g. heel rise + forward lean) rank the mapped cause first.
- Ranks are 1..n with no gaps.

## Content Tony authors (TODO placeholders until then)
- TODO(Tony): Finding → cause mappings, likelihood weights, screening tests (`content/rules/tier2`).

Done when `pnpm test`, `pnpm lint` and `pnpm typecheck` pass.
