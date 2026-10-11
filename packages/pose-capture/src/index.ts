export const MODULE = "M4" as const;

export { createPoseCapture, processVideo, NoPoseFoundError } from "./capture";
export type { CaptureDeps, CaptureOptions, PoseCapture } from "./capture";
export { DEFAULT_MIN_VISIBILITY, DEFAULT_SAMPLE_FPS, DEFAULT_WASM_BASE_PATH, POSE_MODEL_URLS, WASM_FILES } from "./config";
export type { PoseModel } from "./config";
export type { PoseDetector } from "./detector";
export { createFrameSmoother, lowVisibilityLandmarks, toPoseFrame } from "./frames";
export type { RawLandmark, RawPose } from "./frames";
export { DEFAULT_ONE_EURO, OneEuroFilter } from "./one-euro";
export type { OneEuroParams } from "./one-euro";
export type { FrameSource, SourceFrame } from "./sources";
export { trackingQuality } from "./quality";
export type { TrackingQuality } from "./quality";
