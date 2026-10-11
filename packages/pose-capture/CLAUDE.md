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
- Hosting (decided 2026-10-10):
  - WASM: served same-origin by the web app at `/analyzer/mediapipe/wasm/[file]` (route in apps/web/app/(analyzer)), reading
    this package's own tasks-vision install via `@optimass/pose-capture/server`. Keeps runtime and JS in lockstep, no CDN.
    Found by path, not `require.resolve`: Turbopack tries to compile a resolved .wasm and fails.
  - Model: Google's `pose_landmarker_full` float16 v1 on storage.googleapis.com (~9 MB, browser-cached). `lite`/`heavy` selectable.
- Worker: `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })`. tasks-vision 1.1.0 falls back from
  `importScripts` to a module import inside module workers. GPU delegate first, CPU if that fails.
- Uploads are stepped by seeking at `sampleFps` (30 default), so no frame is dropped and results don't depend on phone speed.
  Camera streams drop frames while the detector is busy. Frames with no body are left out of the sequence.
- Smoothing: One Euro per landmark coordinate (minCutoff 1 Hz, beta 40; tuning, not clinical). Landmarks below
  minVisibility (0.5) pass through unsmoothed with their low visibility as the flag, and restart the filter when seen again.
- Speed seen 2026-10-10: ~0.5 s/frame in a headless container on software GL (14 s clip = 3.5 min). Real phones on GPU
  should be far faster; unmeasured yet. Lower `sampleFps` or the `lite` model if phones are slow.
- Output order is MediaPipe's 33 landmarks; `POSE_LANDMARK` in `@optimass/types` maps names to indices.
