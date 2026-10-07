// Per-frame pulldown metrics computed from MediaPipe world landmarks (3D, meters).
// Everything here is geometry: no thresholds and no judgement of good or bad.
import { POSE_LANDMARK, type PoseLandmarkName, type PoseSequence } from "@optimass/types";
import type { KinematicSeries } from "../index";
import { derivative, smooth } from "../signal";
import { angleBetweenDeg, dist, dot, jointAngleDeg, mid, norm, rejectFrom, RAD_TO_DEG, sub, unit, v, type Vec3 } from "../vec3";

/**
 * Stable metric names. Angles are degrees, angular velocities degrees per second, speeds meters per second,
 * heights meters. Left/right are the lifter's own sides.
 */
export const PULLDOWN_ANGLE_METRICS = [
  "left_elbow_flexion_deg",
  "right_elbow_flexion_deg",
  "left_humerothoracic_elevation_deg",
  "right_humerothoracic_elevation_deg",
  "trunk_lean_deg",
  "hip_flexion_deg",
] as const;

export const PULLDOWN_SPEED_LANDMARKS = [
  "left_wrist",
  "right_wrist",
  "left_elbow",
  "right_elbow",
  "left_shoulder",
  "right_shoulder",
] as const satisfies readonly PoseLandmarkName[];

export interface MetricOptions {
  /** Moving-average window (frames) applied to landmark coordinates before any math. 1 disables smoothing. */
  smoothingWindow?: number;
}

/** World "up". MediaPipe world y points down; this assumes the camera is roughly level. */
const UP = v(0, -1, 0);

function landmarkTracks(seq: PoseSequence, window: number): Record<PoseLandmarkName, Vec3[]> {
  const out = {} as Record<PoseLandmarkName, Vec3[]>;
  for (const [name, idx] of Object.entries(POSE_LANDMARK) as [PoseLandmarkName, number][]) {
    const xs = seq.frames.map((f) => f.worldLandmarks[idx]!.x);
    const ys = seq.frames.map((f) => f.worldLandmarks[idx]!.y);
    const zs = seq.frames.map((f) => f.worldLandmarks[idx]!.z);
    const [sx, sy, sz] = window > 1 ? [smooth(xs, window), smooth(ys, window), smooth(zs, window)] : [xs, ys, zs];
    out[name] = sx.map((x, i) => v(x, sy[i]!, sz[i]!));
  }
  return out;
}

/**
 * Computes the per-frame series for a seated vertical pull.
 *
 * - `*_elbow_flexion_deg`: 180 minus the shoulder–elbow–wrist angle (0 = straight arm).
 * - `*_humerothoracic_elevation_deg`: angle between the upper arm and the trunk's downward axis
 *   (0 = arm hanging at the side, ~180 = straight overhead). Plane-free, so it mixes flexion and abduction.
 * - `trunk_lean_deg`: trunk (hip midpoint → shoulder midpoint) from vertical in the sagittal plane;
 *   positive = leaning back. "Forward" is taken from the thighs (hip → knee), which point forward when seated.
 * - `hip_flexion_deg`: 180 minus the shoulder–hip–knee angle at the midpoints.
 * - `*_shoulder_ear_gap_ratio`: ear-to-shoulder distance divided by shoulder width. Drops when the shoulders shrug.
 * - `wrist_mid_height_m`: wrist midpoint height above the shoulder midpoint (bar-height proxy).
 * - `wrist_height_diff_m`: left wrist height minus right (bar tilt).
 * - `elbow_flexion_diff_deg`: left minus right elbow flexion.
 * - `<angle>_vel_dps`: time derivative of each angle above.
 * - `<landmark>_speed_mps`: linear speed of wrists, elbows and shoulders relative to the hip midpoint
 *   (world landmarks are hip-centered, so whole-body sliding does not show up here).
 */
export function pulldownSeries(seq: PoseSequence, options: MetricOptions = {}): KinematicSeries {
  const window = options.smoothingWindow ?? 5;
  const lm = landmarkTracks(seq, window);
  const timestampsMs = seq.frames.map((f) => f.timestampMs);
  const n = timestampsMs.length;
  const metrics: Record<string, number[]> = {};
  const put = (name: string, i: number, value: number) => {
    (metrics[name] ??= new Array<number>(n).fill(Number.NaN))[i] = value;
  };

  for (let i = 0; i < n; i++) {
    const p = (name: PoseLandmarkName) => lm[name][i]!;
    const shoulderMid = mid(p("left_shoulder"), p("right_shoulder"));
    const hipMid = mid(p("left_hip"), p("right_hip"));
    const kneeMid = mid(p("left_knee"), p("right_knee"));
    const trunk = sub(shoulderMid, hipMid);
    const trunkDown = sub(hipMid, shoulderMid);
    const forward = unit(rejectFrom(sub(kneeMid, hipMid), UP));
    const shoulderWidth = dist(p("left_shoulder"), p("right_shoulder"));

    for (const side of ["left", "right"] as const) {
      const shoulder = p(`${side}_shoulder`);
      const elbow = p(`${side}_elbow`);
      const wrist = p(`${side}_wrist`);
      put(`${side}_elbow_flexion_deg`, i, 180 - jointAngleDeg(shoulder, elbow, wrist));
      put(`${side}_humerothoracic_elevation_deg`, i, angleBetweenDeg(sub(elbow, shoulder), trunkDown));
      put(`${side}_shoulder_ear_gap_ratio`, i, dist(p(`${side}_ear`), shoulder) / shoulderWidth);
    }
    put("trunk_lean_deg", i, Math.atan2(-dot(trunk, forward), dot(trunk, UP)) * RAD_TO_DEG);
    put("hip_flexion_deg", i, 180 - jointAngleDeg(shoulderMid, hipMid, kneeMid));

    const wristMid = mid(p("left_wrist"), p("right_wrist"));
    put("wrist_mid_height_m", i, dot(sub(wristMid, shoulderMid), UP));
    put("wrist_height_diff_m", i, dot(sub(p("left_wrist"), p("right_wrist")), UP));
  }
  metrics.elbow_flexion_diff_deg = metrics.left_elbow_flexion_deg!.map((l, i) => l - metrics.right_elbow_flexion_deg![i]!);

  for (const name of PULLDOWN_ANGLE_METRICS) {
    metrics[name.replace(/_deg$/, "_vel_dps")] = derivative(metrics[name]!, timestampsMs);
  }
  for (const name of PULLDOWN_SPEED_LANDMARKS) {
    const track = lm[name];
    const dt = (i: number, j: number) => (timestampsMs[j]! - timestampsMs[i]!) / 1000;
    metrics[`${name}_speed_mps`] = track.map((_, i) => {
      const lo = Math.max(0, i - 1);
      const hi = Math.min(n - 1, i + 1);
      return hi > lo ? norm(sub(track[hi]!, track[lo]!)) / dt(lo, hi) : 0;
    });
  }
  return { timestampsMs, metrics };
}
