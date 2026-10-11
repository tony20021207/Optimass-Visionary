/**
 * Where MediaPipe's runtime and model come from. Decided in M4 (2026-10-10), see this package's CLAUDE.md.
 * - WASM: served by the web app from this package's own @mediapipe/tasks-vision install, so the runtime always
 *   matches the JS version and no third-party CDN is needed.
 * - Model: Google's hosted pose_landmarker_full (about 9 MB, cached by the browser after the first set).
 */
export const DEFAULT_WASM_BASE_PATH = "/analyzer/mediapipe/wasm";

export const POSE_MODEL_URLS = {
  lite: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  full: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
  heavy: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
} as const;
export type PoseModel = keyof typeof POSE_MODEL_URLS;

/** The files the WASM route may serve (everything in tasks-vision's wasm/ folder). */
export const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_module_internal.js",
  "vision_wasm_module_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
] as const;

/**
 * Tracking settings, not clinical values: how sure MediaPipe must be before a landmark counts, and how many
 * frames per second an uploaded video is sampled at.
 */
export const DEFAULT_MIN_VISIBILITY = 0.5;
export const DEFAULT_SAMPLE_FPS = 30;
