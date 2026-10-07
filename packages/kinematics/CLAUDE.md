# @optimass/kinematics (M5)

Kinematics: joint and segment angles, angular velocity, rep segmentation, tempo, ROM, symmetry and bar-path proxy from PoseFrame[]. Pure math.

- Owner: lane L3 Vision. Only that lane edits this folder.
- Spec: docs/specs/M5.md
- Public API: everything exported from `src/index.ts` (stubs that throw until implemented).
- May import: `@optimass/types`. Nothing from apps/web or other lanes' packages not listed here.
- Tests: `pnpm --filter @optimass/kinematics test`. Use fixtures from `@optimass/types/fixtures`, not live services.
- Clinical values (thresholds, weights, norms, dosages) come from content/, authored by Tony. Never hard-code them.
