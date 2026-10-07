# @optimass/kinematics (M5)

Kinematics: joint and segment angles, angular velocity, rep segmentation, tempo, ROM, symmetry and bar-path proxy from PoseFrame[]. Pure math.

- Owner: lane L3 Vision. Only that lane edits this folder.
- Spec: docs/specs/M5.md
- Public API: everything exported from `src/index.ts` (stubs that throw until implemented).
- May import: `@optimass/types`. Nothing from apps/web or other lanes' packages not listed here.
- Tests: `pnpm --filter @optimass/kinematics test`. Use fixtures from `@optimass/types/fixtures`, not live services.
- Clinical values (thresholds, weights, norms, dosages) come from content/, authored by Tony. Never hard-code them.

## Pulldown experiment (src/pulldown/)
- Synthetic lat pulldown clips (good + 5 faults) built as a 3D stick figure in MediaPipe's 33-landmark layout: `synth.ts`.
- Per-frame metrics from world landmarks (`metrics.ts`), rep segmentation on bar height (`segment.ts`),
  per-rep features (`features.ts`), checks against `good-pulldown.params.json` (`evaluate.ts`).
- Every number in the params file is a placeholder until Tony reviews it. It moves to content/rules/tier1 once M6a
  defines the Tier 1 rule schema; judging reps then belongs to M6a.
- `pnpm --filter @optimass/kinematics pulldown:report` prints the feature table for every synthetic variant.

## Capture protocol (decided by Tony, 2026-10-07)
- Source of truth: `src/capture-protocol.json`, read through `src/camera.ts`.
- Every exercise is filmed from 45° behind and to one side (azimuth 135° = behind-left, 225° = behind-right),
  lens at the lifter's waist height in the exercise position, camera level. Whole body incl. hands in frame.
- Before analysis, a standing posture check is captured from the front, back, left and right (`src/posture/`).
  Sagittal posture features use the side views, frontal features the front/back views.
- Metrics are computed in 3D world coordinates, so they do not depend on the view; the view changes which
  landmarks are visible and how much depth noise each metric picks up.
- `CameraView` in @optimass/types has no oblique value yet, so 45° clips are tagged "sagittal" (TODO in camera.ts).
