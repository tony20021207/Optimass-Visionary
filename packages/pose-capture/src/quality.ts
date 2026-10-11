import { POSE_LANDMARK } from "@optimass/types";
import type { PoseLandmarkName, PoseSequence } from "@optimass/types";

export interface TrackingQuality {
  /** Frames sampled from the video. */
  framesSampled: number;
  /** Frames where a whole body was found. */
  framesWithPose: number;
  /** For each landmark asked about: share of sampled frames where it was seen clearly (0..1). */
  seen: Partial<Record<PoseLandmarkName, number>>;
}

/** How well the body was tracked, for the landmarks an exercise needs. */
export function trackingQuality(
  sequence: Pick<PoseSequence, "frames">,
  framesSampled: number,
  landmarks: readonly PoseLandmarkName[],
  minVisibility: number,
): TrackingQuality {
  const total = Math.max(framesSampled, sequence.frames.length, 1);
  const seen: TrackingQuality["seen"] = {};
  for (const name of landmarks) {
    const i = POSE_LANDMARK[name];
    seen[name] = sequence.frames.filter((f) => f.landmarks[i]!.visibility >= minVisibility).length / total;
  }
  return { framesSampled: Math.max(framesSampled, sequence.frames.length), framesWithPose: sequence.frames.length, seen };
}
