# @optimass/pose-capture (M4)

Pose capture: MediaPipe Pose Landmarker in a Web Worker, camera and upload input, smoothing and visibility gating. Emits PoseFrame streams. No domain logic.

- Owner: lane L3 Vision. Only that lane edits this folder.
- Spec: docs/specs/M4.md
- Public API: everything exported from `src/index.ts` (stubs that throw until implemented).
- May import: `@optimass/types`, `@mediapipe/tasks-vision`. Nothing from apps/web or other lanes' packages not listed here.
- Tests: `pnpm --filter @optimass/pose-capture test`. Use fixtures from `@optimass/types/fixtures`, not live services.
- Clinical values (thresholds, weights, norms, dosages) come from content/, authored by Tony. Never hard-code them.

## MediaPipe notes (write findings here so later sessions don't re-research)
- Package: `@mediapipe/tasks-vision` (installed in Phase 0). Use `PoseLandmarker` with `runningMode: "VIDEO"` and `detectForVideo(video, timestampMs)`.
- Run inference in a Web Worker; post `PoseFrame` objects matching `PoseFrame` from `@optimass/types`.
- Model file (`pose_landmarker_*.task`) and WASM assets: decide hosting in M4 and record the choice here.
- Output order is MediaPipe's 33 landmarks; `POSE_LANDMARK` in `@optimass/types` maps names to indices.
