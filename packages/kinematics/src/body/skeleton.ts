// Personal skeleton: segment lengths, proportions and side-to-side differences measured from the 4-view posture
// check. Used to fit exercise clips (fit.ts) and as anthropometric input for Tier 2.
import { POSE_LANDMARK, type PoseLandmarkName, type PoseSequence } from "@optimass/types";
import { mean } from "../signal";
import { dist } from "../vec3";
import type { PostureCapture } from "../posture/synth";

/** Rigid segments: joint-center to joint-center distances that should not change during a lift. */
export const RIGID_SEGMENTS = {
  left_upper_arm: ["left_shoulder", "left_elbow"],
  right_upper_arm: ["right_shoulder", "right_elbow"],
  left_forearm: ["left_elbow", "left_wrist"],
  right_forearm: ["right_elbow", "right_wrist"],
  left_thigh: ["left_hip", "left_knee"],
  right_thigh: ["right_hip", "right_knee"],
  left_shin: ["left_knee", "left_ankle"],
  right_shin: ["right_knee", "right_ankle"],
  hip_width: ["left_hip", "right_hip"],
} as const satisfies Record<string, readonly [PoseLandmarkName, PoseLandmarkName]>;
export type RigidSegment = keyof typeof RIGID_SEGMENTS;

/**
 * Measured in standing but NOT rigid during lifts (the shoulder girdle and spine move), so they describe
 * proportions and are never used as fitting constraints.
 */
export const POSTURAL_SEGMENTS = {
  shoulder_width: ["left_shoulder", "right_shoulder"],
  left_trunk: ["left_shoulder", "left_hip"],
  right_trunk: ["right_shoulder", "right_hip"],
} as const satisfies Record<string, readonly [PoseLandmarkName, PoseLandmarkName]>;
export type PosturalSegment = keyof typeof POSTURAL_SEGMENTS;
type Segment = RigidSegment | PosturalSegment;

export interface SegmentMeasurement {
  /** Median across the views where both ends were visible, meters (MediaPipe scale unless heightM was given). */
  lengthM: number;
  /** Per-view lengths, to judge how consistent the capture was. */
  perView: Record<string, number>;
  /** (max − min) / median across views. */
  spread: number;
}

export interface Skeleton {
  segments: Record<Segment, SegmentMeasurement>;
  /** Bilateral means and ratios, e.g. thigh_to_shin. Dimensionless unless the name ends in _m. */
  proportions: Record<string, number>;
  /** Left minus right, meters. */
  sideDifferenceM: Record<"upper_arm" | "forearm" | "thigh" | "shin", number>;
  /** Multiplier applied to every length (1 unless the user's height was given). */
  scale: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Visibility below which a landmark's view is not used for that segment. */
const MIN_VISIBILITY = 0.5;

function segmentInView(seq: PoseSequence, a: PoseLandmarkName, b: PoseLandmarkName): number | null {
  const ia = POSE_LANDMARK[a];
  const ib = POSE_LANDMARK[b];
  const ok = seq.frames.filter((f) => f.worldLandmarks[ia]!.visibility >= MIN_VISIBILITY && f.worldLandmarks[ib]!.visibility >= MIN_VISIBILITY);
  if (ok.length === 0) return null;
  return median(ok.map((f) => dist(f.worldLandmarks[ia]!, f.worldLandmarks[ib]!)));
}

/**
 * Builds the personal skeleton from the posture captures. Pass `heightM` (the user's stature) to convert MediaPipe's
 * estimated scale to real meters; stature is estimated as heel-to-ear height plus a placeholder ear-to-crown offset.
 */
export function calibrateSkeleton(captures: PostureCapture[], options: { heightM?: number } = {}): Skeleton {
  const all = { ...RIGID_SEGMENTS, ...POSTURAL_SEGMENTS } as Record<Segment, readonly [PoseLandmarkName, PoseLandmarkName]>;
  let scale = 1;
  if (options.heightM) {
    const EAR_TO_CROWN_M = 0.12; // PLACEHOLDER anthropometric offset
    const statures = captures.map((c) => {
      const f = c.sequence.frames;
      const y = (n: PoseLandmarkName) => mean(f.map((fr) => fr.worldLandmarks[POSE_LANDMARK[n]]!.y));
      return (y("left_heel") + y("right_heel")) / 2 - (y("left_ear") + y("right_ear")) / 2 + EAR_TO_CROWN_M;
    });
    scale = options.heightM / median(statures);
  }
  const segments = {} as Record<Segment, SegmentMeasurement>;
  for (const [name, [a, b]] of Object.entries(all) as [Segment, readonly [PoseLandmarkName, PoseLandmarkName]][]) {
    const perView: Record<string, number> = {};
    for (const c of captures) {
      const len = segmentInView(c.sequence, a, b);
      if (len !== null) perView[c.view] = len * scale;
    }
    const values = Object.values(perView);
    if (values.length === 0) throw new Error(`skeleton: ${name} was not visible in any posture view`);
    const lengthM = median(values);
    segments[name] = { lengthM, perView, spread: (Math.max(...values) - Math.min(...values)) / lengthM };
  }
  const L = (s: Segment) => segments[s].lengthM;
  const both = (side: "upper_arm" | "forearm" | "thigh" | "shin") => (L(`left_${side}`) + L(`right_${side}`)) / 2;
  const trunk = (L("left_trunk") + L("right_trunk")) / 2;
  return {
    segments,
    proportions: {
      upper_arm_m: both("upper_arm"),
      forearm_m: both("forearm"),
      thigh_m: both("thigh"),
      shin_m: both("shin"),
      trunk_m: trunk,
      thigh_to_shin: both("thigh") / both("shin"),
      thigh_to_trunk: both("thigh") / trunk,
      upper_arm_to_forearm: both("upper_arm") / both("forearm"),
      arm_to_trunk: (both("upper_arm") + both("forearm")) / trunk,
      shoulder_to_hip_width: L("shoulder_width") / L("hip_width"),
    },
    sideDifferenceM: {
      upper_arm: L("left_upper_arm") - L("right_upper_arm"),
      forearm: L("left_forearm") - L("right_forearm"),
      thigh: L("left_thigh") - L("right_thigh"),
      shin: L("left_shin") - L("right_shin"),
    },
    scale,
  };
}
