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
- Shoulder extension vs adduction: integrated from frame-to-frame humeral rotation in a trunk frame
  (`*_shoulder_extension_cum_deg`, `*_shoulder_adduction_cum_deg`). Don't replace this with sagittal/frontal
  projection angles: near overhead both projections sweep the full arc and double-count the movement.
- Tony's pulldown standard (2026-10-07): grip 2.0x shoulder width; bar travels a line ~12-15 deg off vertical
  (`pullLineDeg`); pulley above the knees; forearms on the cable line (bar → pulley, side view) until a slight
  break at the bottom; stop with the elbows just
  past the trunk line.
- Baseline from Tony's Motion Lab settings (2026-10-09): grip 2.2x, line 14.5 deg, 11 deg elbow bend at the top
  (bent out to the side), trunk swing 18 deg (trunk limits loosened to match), arms 42 deg from the trunk at the bottom,
  pulley 1.53 m above the hips and 0.22 m behind the knees. Tier 1's pulley assumption (MetricOptions) uses the same
  position. New fault codes not yet in the Tier 2 YAML: excessive_shoulder_extension, bar_path_off_line,
  forearm_off_line.
- Line of pull aims at the pulley by default (`lineToPulley`, Tony 2026-10-09): moving the pulley tilts the line
  (wide grip ~14°). Close grips keep forearms on the cable all the way (bar stops near the collarbone).
- Forearms on the line of pull in the FRONT view too, over the bottom 80% of the pull (Tony, 2026-10-09): check
  forearms_on_line_front. Grip formula in `grip.ts` (best fit: hands under the middle of the elbow's sideways swing;
  2.2x on the synthetic lifter); with a skeleton, analyzePulldown reports recommendedGrip and grip_vs_recommended.
- Yank detection (Tony, 2026-10-09): per-frame angular (`*_acc_dps2`) and vector landmark (`*_acc_mps2`) acceleration;
  check no_yank on wrist_peak_acc_mps2 (fault `yanking`, not in the Tier 2 YAML yet). Elbow/shoulder/trunk
  accelerations are info only: too noisy to separate a yank on synthetic data.
- `pnpm --filter @optimass/kinematics pulldown:report` prints the feature table for every synthetic variant.

## Capture protocol (decided by Tony, 2026-10-07)
- Source of truth: `src/capture-protocol.json`, read through `src/camera.ts`.
- Every exercise is filmed from 45° behind and to one side (azimuth 135° = behind-left, 225° = behind-right),
  camera level, whole body incl. hands in frame. Distance and height (Tony, 2026-10-09): 1.5 x the user's height
  away, lens centred on the movement's vertical span (`cameraHeightByExercise`; pulldown = seated shoulder height).
  The root CLAUDE.md still says waist height; that file is updated on main.
- Before analysis, a standing posture check is captured straight-on from the front, back, left and right, 1 body height
  away with the lens at hip height (`src/posture/`, `postureCamera`).
  Sagittal posture features use the side views, frontal features the front/back views.
- Metrics are computed in 3D world coordinates, so they do not depend on the view; the view changes which
  landmarks are visible and how much depth noise each metric picks up.
- `CameraView` in @optimass/types has no oblique value yet, so 45° clips are tagged "sagittal" (TODO in camera.ts).

## Personal skeleton (src/body/)
- `calibrateSkeleton` turns the 4 posture captures into segment lengths, proportions (e.g. thigh_to_shin) and
  left-right differences. Pass the user's height to convert to real meters.
- `fitToSkeleton` holds each limb bone at its calibrated length, trusting image-plane x/y over depth z.
  `analyzePulldown(seq, params, { skeleton })` fits before measuring and reports per-frame bone error.
- Trunk and shoulder width are proportions only, never fitting constraints (the shoulder girdle moves).
