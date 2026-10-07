# M6a: Diagnostics Tier 1: kinematic errors

- Lane: L4
- Location: `packages/diagnostics (tier1/)`
- Contracts: `@optimass/types`

## Inputs → outputs
`KinematicInput` + Tier 1 rule tables → `KinematicFinding[]`

## Responsibilities
- Evaluate per-exercise rules (metric, comparator, threshold, rep scope, severity bands).
- A rule fires only when the clip's camera view equals the rule's required view.
- Initial lifts: squat, RDL, bench (rules authored by Tony).

## Out of scope
- Root causes (M6b).

## Acceptance tests
- `squatFrontalValgus` + a placeholder valgus rule flags rep 1 only.
- A frontal-only rule never fires on a sagittal clip.
- Every finding parses with `KinematicFinding` and cites its evidence.

## Content Tony authors (TODO placeholders until then)
- TODO(Tony): Tier 1 rules and thresholds per lift (`content/rules/tier1`).

Done when `pnpm test`, `pnpm lint` and `pnpm typecheck` pass.
