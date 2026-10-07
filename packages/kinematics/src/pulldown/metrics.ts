// Per-frame pulldown metrics computed from MediaPipe world landmarks (3D, meters).
// Everything here is geometry: no thresholds and no judgement of good or bad.
import { POSE_LANDMARK, type PoseLandmarkName, type PoseSequence } from "@optimass/types";
import type { KinematicSeries } from "../index";
import { derivative, smooth } from "../signal";
import { add, angleBetweenDeg, cross, dist, dot, jointAngleDeg, mid, norm, rejectFrom, RAD_TO_DEG, scale, sub, unit, v, type Vec3 } from "../vec3";

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
  /**
   * Assumed pulley height above the hips (m), used to estimate the cable's direction (pulley taken to be straight above
   * the knees). Equipment assumption, not measured: MediaPipe cannot see the machine. Default 1.6.
   */
  pulleyAboveHipM?: number;
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
 * - `*_shoulder_extension_cum_deg` / `*_shoulder_adduction_cum_deg`: running total of how far the upper arm has
 *   rotated about the trunk's side-to-side axis (extension, + = arm moving down/back from in front) and about its
 *   front-to-back axis (adduction, + = arm moving down toward the side from out wide), from the first frame.
 *   The difference between two frames is the extension or adduction performed between them. Built by integrating
 *   frame-to-frame humeral rotation, so it splits a diagonal pull correctly; projecting the arm onto the sagittal
 *   and frontal planes does not (an arm near overhead sweeps almost the whole arc in both projections).
 * - `*_plane_of_elevation_deg`: which way the upper arm points around the trunk, seen from above: 0 = straight out
 *   to the side (frontal plane), 90 = straight forward (sagittal plane). NaN when the arm is near vertical
 *   (straight up or down), where the direction is undefined.
 * - `*_humerus_behind_trunk_deg`: upper arm angle out of the trunk's frontal plane (+ = elbow behind the body, the
 *   arm rotating back around the shoulder past the trunk line; − = elbow in front).
 * - `*_elbow_forward_m`: elbow ahead of the shoulder along the trunk's forward axis (+ = in front of the body).
 *   Projections are taken in a trunk frame (down = shoulders→hips, forward = thighs' direction made perpendicular
 *   to the trunk), so leaning back does not count as shoulder movement.
 * - `trunk_lean_deg`: trunk (hip midpoint → shoulder midpoint) from vertical in the sagittal plane;
 *   positive = leaning back. "Forward" is taken from the thighs (hip → knee), which point forward when seated.
 * - `hip_flexion_deg`: 180 minus the shoulder–hip–knee angle at the midpoints.
 * - `*_shoulder_ear_gap_ratio`: ear-to-shoulder distance divided by shoulder width. Drops when the shoulders shrug.
 * - `head_forward_m`: ear midpoint ahead of the shoulder midpoint, perpendicular to the trunk (0 = ears in line
 *   with the trunk). Uses the ears, which stay visible from behind.
 * - `wrist_mid_fwd_m`: wrist midpoint distance ahead of the hip midpoint along the room's forward axis (bar path, with
 *   `wrist_mid_up_m`, its height above the hips). Room axes, not trunk, because the cable is fixed in the room.
 * - `*_forearm_pitch_deg`: forearm (elbow → wrist) angle from vertical seen from the side, + = wrist ahead of the elbow.
 *   Compared with `cable_pitch_deg` it says whether the forearm is on the line of the force.
 * - `cable_pitch_deg`: estimated cable angle from vertical, side view, from the wrist midpoint to a pulley assumed to
 *   sit `pulleyAboveHipM` above the hips and straight above the knees (+ = pulley ahead of the hands).
 * - `wrist_mid_height_m`: wrist midpoint height above the shoulder midpoint (bar-height proxy).
 * - `grip_width_x_shoulder`: wrist-to-wrist distance ÷ shoulder-to-shoulder distance (hand spacing on the bar).
 * - `wrist_height_diff_m`: left wrist height minus right (bar tilt).
 * - `elbow_flexion_diff_deg`: left minus right elbow flexion.
 * - `<angle>_vel_dps`: time derivative of each angle above.
 * - `<landmark>_speed_mps`: linear speed of wrists, elbows and shoulders relative to the hip midpoint
 *   (world landmarks are hip-centered, so whole-body sliding does not show up here).
 */
export function pulldownSeries(seq: PoseSequence, options: MetricOptions = {}): KinematicSeries {
  const window = options.smoothingWindow ?? 5;
  const pulleyAboveHip = options.pulleyAboveHipM ?? 1.6;
  const lm = landmarkTracks(seq, window);
  const timestampsMs = seq.frames.map((f) => f.timestampMs);
  const n = timestampsMs.length;
  const metrics: Record<string, number[]> = {};
  const put = (name: string, i: number, value: number) => {
    (metrics[name] ??= new Array<number>(n).fill(Number.NaN))[i] = value;
  };

  const prevHumerus: Record<"left" | "right", Vec3 | undefined> = { left: undefined, right: undefined };
  for (let i = 0; i < n; i++) {
    const p = (name: PoseLandmarkName) => lm[name][i]!;
    const shoulderMid = mid(p("left_shoulder"), p("right_shoulder"));
    const hipMid = mid(p("left_hip"), p("right_hip"));
    const kneeMid = mid(p("left_knee"), p("right_knee"));
    const trunk = sub(shoulderMid, hipMid);
    const trunkDown = sub(hipMid, shoulderMid);
    const forward = unit(rejectFrom(sub(kneeMid, hipMid), UP));
    const shoulderWidth = dist(p("left_shoulder"), p("right_shoulder"));

    // Trunk frame. Humerus direction is stored as (down, forward, outward) components so that leaning back is not
    // counted as shoulder movement.
    const down = unit(trunkDown);
    const trunkFwd = unit(rejectFrom(forward, down));
    const leftward = unit(rejectFrom(rejectFrom(sub(p("left_shoulder"), p("right_shoulder")), down), trunkFwd));
    put("grip_width_x_shoulder", i, dist(p("left_wrist"), p("right_wrist")) / shoulderWidth);
    for (const side of ["left", "right"] as const) {
      const shoulder = p(`${side}_shoulder`);
      const elbow = p(`${side}_elbow`);
      const wrist = p(`${side}_wrist`);
      const humerus = sub(elbow, shoulder);
      const outward = side === "left" ? leftward : scale(leftward, -1);
      const hd = dot(humerus, down);
      const hf = dot(humerus, trunkFwd);
      const ho = dot(humerus, outward);
      const u = unit(v(hd, hf, ho));
      const prev = prevHumerus[side];
      let ext = 0;
      let add = 0;
      if (prev) {
        // Rotation vector from prev to u, in (down, forward, outward) components. Its outward part is +flexion,
        // its forward part is -abduction (right-handed: down × forward = outward, outward × down = forward).
        const axis = cross(prev, u);
        const s = norm(axis);
        const k = s < 1e-9 ? 0 : Math.atan2(s, dot(prev, u)) / s;
        ext = -axis.z * k * RAD_TO_DEG;
        add = axis.y * k * RAD_TO_DEG;
      }
      prevHumerus[side] = u;
      put(`${side}_shoulder_extension_cum_deg`, i, (i > 0 ? metrics[`${side}_shoulder_extension_cum_deg`]![i - 1]! : 0) + ext);
      put(`${side}_shoulder_adduction_cum_deg`, i, (i > 0 ? metrics[`${side}_shoulder_adduction_cum_deg`]![i - 1]! : 0) + add);
      const horizontal = Math.hypot(hf, ho);
      put(`${side}_plane_of_elevation_deg`, i, horizontal < 0.25 * norm(humerus) ? Number.NaN : Math.atan2(hf, ho) * RAD_TO_DEG);
      put(`${side}_elbow_forward_m`, i, hf);
      put(`${side}_humerus_behind_trunk_deg`, i, Math.asin(Math.max(-1, Math.min(1, -hf / norm(humerus)))) * RAD_TO_DEG);
      put(`${side}_elbow_flexion_deg`, i, 180 - jointAngleDeg(shoulder, elbow, wrist));
      put(`${side}_humerothoracic_elevation_deg`, i, angleBetweenDeg(sub(elbow, shoulder), trunkDown));
      put(`${side}_shoulder_ear_gap_ratio`, i, dist(p(`${side}_ear`), shoulder) / shoulderWidth);
    }
    put("trunk_lean_deg", i, Math.atan2(-dot(trunk, forward), dot(trunk, UP)) * RAD_TO_DEG);
    put("hip_flexion_deg", i, 180 - jointAngleDeg(shoulderMid, hipMid, kneeMid));
    const trunkForward = unit(rejectFrom(forward, trunk));
    put("head_forward_m", i, dot(sub(mid(p("left_ear"), p("right_ear")), shoulderMid), trunkForward));

    const wristMid = mid(p("left_wrist"), p("right_wrist"));
    put("wrist_mid_height_m", i, dot(sub(wristMid, shoulderMid), UP));
    put("wrist_mid_up_m", i, dot(sub(wristMid, hipMid), UP));
    put("wrist_mid_fwd_m", i, dot(sub(wristMid, hipMid), forward));
    const pulley = add(add(hipMid, scale(forward, dot(sub(kneeMid, hipMid), forward))), scale(UP, pulleyAboveHip));
    const cable = sub(pulley, wristMid);
    put("cable_pitch_deg", i, Math.atan2(dot(cable, forward), dot(cable, UP)) * RAD_TO_DEG);
    for (const side of ["left", "right"] as const) {
      const forearm = sub(p(`${side}_wrist`), p(`${side}_elbow`));
      put(`${side}_forearm_pitch_deg`, i, Math.atan2(dot(forearm, forward), dot(forearm, UP)) * RAD_TO_DEG);
    }
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
