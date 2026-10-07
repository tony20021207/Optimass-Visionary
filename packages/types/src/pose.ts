import { z } from "zod";
import { CameraView, NumericRange, Side, UnitInterval } from "./common";

/** MediaPipe Pose Landmarker's 33 landmarks, in index order. Left/right are the lifter's own sides. */
export const POSE_LANDMARK_NAMES = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
] as const;
export type PoseLandmarkName = (typeof POSE_LANDMARK_NAMES)[number];
export const POSE_LANDMARK_COUNT = POSE_LANDMARK_NAMES.length;

/** Index lookup, e.g. POSE_LANDMARK.left_knee === 25. */
export const POSE_LANDMARK = Object.fromEntries(POSE_LANDMARK_NAMES.map((n, i) => [n, i])) as {
  readonly [K in PoseLandmarkName]: number;
};

/** Image-space landmark: x, y normalized to [0,1] by image width/height (may fall slightly outside); z is relative depth. */
export const NormalizedLandmark = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  visibility: UnitInterval,
  presence: UnitInterval.optional(),
});
export type NormalizedLandmark = z.infer<typeof NormalizedLandmark>;

/** World landmark in meters, origin at the hip midpoint (MediaPipe's estimate from a single camera). */
export const WorldLandmark = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  visibility: UnitInterval,
});
export type WorldLandmark = z.infer<typeof WorldLandmark>;

export const PoseFrame = z.object({
  frameIndex: z.number().int().nonnegative(),
  timestampMs: z.number().nonnegative(),
  landmarks: z.array(NormalizedLandmark).length(POSE_LANDMARK_COUNT),
  worldLandmarks: z.array(WorldLandmark).length(POSE_LANDMARK_COUNT),
});
export type PoseFrame = z.infer<typeof PoseFrame>;

/** A captured or recorded clip: frames plus the metadata kinematics and diagnostics need. */
export const PoseSequence = z.object({
  id: z.string().min(1),
  exerciseId: z.string().min(1),
  cameraView: CameraView,
  fps: z.number().positive(),
  image: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  source: z.enum(["camera", "upload", "fixture"]),
  frames: z.array(PoseFrame).min(1),
});
export type PoseSequence = z.infer<typeof PoseSequence>;

export const RepPhase = z.enum(["eccentric", "bottom_pause", "concentric", "lockout"]);
export type RepPhase = z.infer<typeof RepPhase>;

export const RepSegment = z.object({
  repIndex: z.number().int().nonnegative(),
  side: Side,
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
  phases: z.array(
    z.object({
      phase: RepPhase,
      startMs: z.number().nonnegative(),
      endMs: z.number().nonnegative(),
    }),
  ),
  /** ROM achieved per measured angle (e.g. "left_knee_flexion"), in degrees. */
  romDeg: z.record(z.string(), NumericRange).default({}),
});
export type RepSegment = z.infer<typeof RepSegment>;
