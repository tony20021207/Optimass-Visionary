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
- Clinical joint vocabulary (Tony, 2026-10-10): `src/joints/catalogue.ts` names every joint motion for all exercises
  (shoulder flexion/extension, abduction/adduction, external/internal rotation, elbow flexion, scapular elevation,
  protraction, upward rotation, trunk flexion, hip/knee/ankle...), with + / − directions. Simulation keyframes, video
  measurements and rules should all use these ids.
- Rep phases (Tony, 2026-10-10): near single-joint lifts like the pulldown use 3 phases of equal duration; complex lifts
  (deadlift) get custom break points per exercise. Pulldown: `PULLDOWN_PHASES` (same shape as Tier 2's `phases` in
  content/rules/coaching/lat_pulldown.yaml; that file should become the one source once both PRs merge).
- Shoulder in the simulation (Tony, 2026-10-10): elevation (0 = arm at the side, 180 = overhead) + plane of elevation
  (ISB: 0 = out to the side, 90 = forward), not flexion + abduction angles, which can't place a horizontal arm pointing
  between forward and sideways. Measured frontal abduction and sagittal flexion are readouts.
- Scapular rhythm (Tony, 2026-10-10): scapular upward rotation follows arm elevation per variation
  (`profile.scapularRhythm`: glenohumeral:scapular ratio + onset; PLACEHOLDER 2:1 after 30°). The
  `scapular_upward_rotation` keys are a deviation from it (0 = normal); each joint is still judged on its own.
- Pulldown joint keyframes: each variation sets catalogue joints at PULLDOWN_KEY_AT (top and each phase end: time
  thirds, i.e. 0, 0.25, 0.75, 1 of bar travel on the eased pull), joined by a monotone cubic. Pulley and tempo are shared. Closed chain: shoulder rotation is solved so the hand
  sits on the bar at the grip width (followed continuously from the top), and the plane of elevation shifts only when no
  rotation reaches the bar (pulldownArmOnBar). Presets were fitted to the earlier model (hand within ~6 cm, same check results). Faults
  (PULLDOWN_FAULTS) add joint deltas, so they work on every variation.
- Forearm held, elbow follows (Tony, 2026-10-10): `elbowFlexionHoldingForearm(p, k, targetDeg)` solves keyframe k's elbow
  flexion so the left forearm sits `targetDeg` off the cable in the side view (`pulldownForearmToCableDeg`), hand kept on
  the bar. Motion Lab's "Keep the forearm's direction" toggle uses it while another joint is dragged.
- Lifter from the posture check (Tony, 2026-10-10): `pulldownBodyFromSkeleton(calibrateSkeleton(captures))` gives
  `profile.body` (bone lengths per side, trunk, widths); the joint keyframes then move that person's skeleton.
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
- Optional scapula step (Tony, 2026-10-10; `postureScreen.scapula`, `src/posture/scapula.ts`): upper back bare, with
  the user's consent (warning text in `scapula-predictions.json`). MediaPipe has no scapula points, so spine roots and
  inferior angles are tapped on the back photo, and winging / anterior tilt are graded from a back-view arm-raise clip.
  `predictFromScapula` maps findings to expected Tier 1 error codes via Tony's table (empty until he writes it).
- Metrics are computed in 3D world coordinates, so they do not depend on the view; the view changes which
  landmarks are visible and how much depth noise each metric picks up.
- `CameraView` in @optimass/types has no oblique value yet, so 45° clips are tagged "sagittal" (TODO in camera.ts).

## Personal skeleton (src/body/)
- `calibrateSkeleton` turns the 4 posture captures into segment lengths, proportions (e.g. thigh_to_shin) and
  left-right differences. Pass the user's height to convert to real meters.
- `fitToSkeleton` holds each limb bone at its calibrated length, trusting image-plane x/y over depth z.
  `analyzePulldown(seq, params, { skeleton })` fits before measuring and reports per-frame bone error.
- Trunk and shoulder width are proportions only, never fitting constraints (the shoulder girdle moves).
