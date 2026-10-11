// Fits a single-camera clip to the person's skeleton. Each bone keeps its calibrated length; the joint moves to the
// nearest point that satisfies it, where "nearest" trusts the image plane (world x, y) more than depth (world z),
// because single-camera depth is MediaPipe's weakest estimate. This is the most likely pose under Gaussian noise
// with larger depth variance, solved bone by bone from the hips outward.
import { POSE_LANDMARK, type PoseLandmarkName, type PoseSequence, type WorldLandmark } from "@optimass/types";
import type { RigidSegment, Skeleton } from "./skeleton";

/** Parent → child, in an order where every parent is final before its child. Roots (hips, shoulders) are not moved. */
const CHAINS: [RigidSegment, PoseLandmarkName, PoseLandmarkName][] = [
  ["left_thigh", "left_hip", "left_knee"],
  ["left_shin", "left_knee", "left_ankle"],
  ["right_thigh", "right_hip", "right_knee"],
  ["right_shin", "right_knee", "right_ankle"],
  ["left_upper_arm", "left_shoulder", "left_elbow"],
  ["left_forearm", "left_elbow", "left_wrist"],
  ["right_upper_arm", "right_shoulder", "right_elbow"],
  ["right_forearm", "right_elbow", "right_wrist"],
];

/** Landmarks that ride along when a joint moves (hands with the wrist, feet with the ankle). */
const CARRIED: Partial<Record<PoseLandmarkName, PoseLandmarkName[]>> = {
  left_knee: ["left_ankle", "left_heel", "left_foot_index"],
  right_knee: ["right_ankle", "right_heel", "right_foot_index"],
  left_ankle: ["left_heel", "left_foot_index"],
  right_ankle: ["right_heel", "right_foot_index"],
  left_elbow: ["left_wrist", "left_pinky", "left_index", "left_thumb"],
  right_elbow: ["right_wrist", "right_pinky", "right_index", "right_thumb"],
  left_wrist: ["left_pinky", "left_index", "left_thumb"],
  right_wrist: ["right_pinky", "right_index", "right_thumb"],
};

export interface FitOptions {
  /** Depth noise relative to image-plane noise (standard deviations). A guess until measured on real clips. */
  depthNoiseRatio?: number;
}

export interface FitResult {
  sequence: PoseSequence;
  /** Per frame, the largest |observed − calibrated| bone length before fitting (m). Spikes flag tracking errors. */
  maxBoneErrorM: number[];
}

/**
 * Closest point to `d` on the sphere |q| = L under the metric diag(1, 1, wz): q_i = m_i d_i / (m_i + λ),
 * with λ found by bisection so that |q| = L.
 */
function projectToLength(d: [number, number, number], L: number, wz: number): [number, number, number] {
  const m = [1, 1, wz];
  const at = (lambda: number) => d.map((x, i) => (m[i]! * x) / (m[i]! + lambda)) as [number, number, number];
  const len = (q: number[]) => Math.hypot(...q);
  if (len(d) === 0) return [0, L, 0];
  // |q(λ)| decreases with λ on (−min m, ∞). Bracket the root, then bisect.
  let lo = -wz + 1e-9;
  let hi = 0;
  if (len(d) > L) {
    lo = 0;
    hi = 1;
    while (len(at(hi)) > L) hi *= 2;
  } else {
    while (len(at(lo)) < L && lo > -wz + 1e-12) lo = (lo - wz) / 2; // approach the pole from the right
  }
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (len(at(mid)) > L) lo = mid;
    else hi = mid;
  }
  const q = at((lo + hi) / 2);
  const s = L / (len(q) || 1);
  return [q[0] * s, q[1] * s, q[2] * s];
}

export function fitToSkeleton(seq: PoseSequence, skeleton: Skeleton, options: FitOptions = {}): FitResult {
  const ratio = options.depthNoiseRatio ?? 2.5;
  const wz = 1 / (ratio * ratio);
  const maxBoneErrorM: number[] = [];
  const frames = seq.frames.map((frame) => {
    const w: WorldLandmark[] = frame.worldLandmarks.map((p) => ({ ...p }));
    let worst = 0;
    for (const [segment, parentName, childName] of CHAINS) {
      const target = skeleton.segments[segment].lengthM;
      const parent = w[POSE_LANDMARK[parentName]]!;
      const child = w[POSE_LANDMARK[childName]]!;
      const d: [number, number, number] = [child.x - parent.x, child.y - parent.y, child.z - parent.z];
      worst = Math.max(worst, Math.abs(Math.hypot(...d) - target));
      const q = projectToLength(d, target, wz);
      const shift = [parent.x + q[0] - child.x, parent.y + q[1] - child.y, parent.z + q[2] - child.z] as const;
      for (const name of [childName, ...(CARRIED[childName] ?? [])]) {
        const p = w[POSE_LANDMARK[name]]!;
        p.x += shift[0];
        p.y += shift[1];
        p.z += shift[2];
      }
    }
    maxBoneErrorM.push(worst);
    return { ...frame, worldLandmarks: w };
  });
  return { sequence: { ...seq, frames }, maxBoneErrorM };
}
