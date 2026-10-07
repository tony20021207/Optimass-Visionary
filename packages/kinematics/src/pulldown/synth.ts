// Synthetic lat pulldown clips: a 3D stick figure posed in MediaPipe's 33-landmark layout.
// These exist to exercise the math and to try out parameter values. They are NOT recordings and NOT a clinical
// reference: every body dimension and motion value below is a made-up default chosen to look like a plausible rep.
import { POSE_LANDMARK_NAMES, PoseSequence, type CameraView, type PoseLandmarkName } from "@optimass/types";
import { add, cross, dist, norm, rejectFrom, scale, sub, unit, v, type Vec3 } from "../vec3";

/** How one synthetic set moves. Times are seconds, distances meters, angles degrees. */
export interface PulldownProfile {
  reps: number;
  /** Still time at the top before the first rep. */
  leadS: number;
  concentricS: number;
  bottomPauseS: number;
  eccentricS: number;
  topPauseS: number;
  /** Trunk lean back from vertical held through the set. */
  trunkLeanDeg: number;
  /** Extra lean added as the bar comes down (swinging the torso for momentum). */
  trunkSwingDeg: number;
  /** Shoulder-to-wrist distance at the top as a fraction of full arm length (1 = elbows locked). */
  topReachFraction: number;
  /** Wrist height relative to the shoulders at the bottom (negative = below shoulder level, bar at the chest). */
  bottomWristAboveShoulderM: number;
  /** Shoulder girdle elevation along the trunk at the top and the bottom (positive = toward the ears). */
  shoulderElevationTopM: number;
  shoulderElevationBottomM: number;
  /** Right hand stays this much higher than the left at the bottom (an uneven pull). */
  rightHandLagM: number;
  /** Std. dev. of per-landmark jitter added to world coordinates, mimicking estimation noise. */
  noiseM: number;
  seed: number;
}

export const GOOD_PULLDOWN: PulldownProfile = {
  reps: 3,
  leadS: 0.6,
  concentricS: 1.0,
  bottomPauseS: 0.3,
  eccentricS: 2.0,
  topPauseS: 0.5,
  trunkLeanDeg: 12,
  trunkSwingDeg: 4,
  topReachFraction: 0.995,
  bottomWristAboveShoulderM: -0.05,
  shoulderElevationTopM: 0.03,
  shoulderElevationBottomM: -0.02,
  rightHandLagM: 0,
  noiseM: 0.004,
  seed: 1,
};

/** One profile per common fault, each changing only what that fault changes. */
export const PULLDOWN_VARIANTS = {
  good: GOOD_PULLDOWN,
  /** Torso swings back hard to start the bar moving. */
  momentum_swing: { ...GOOD_PULLDOWN, concentricS: 0.6, trunkLeanDeg: 10, trunkSwingDeg: 28, seed: 2 },
  /** Elbows never straighten at the top and the bar stops around the chin. */
  partial_rom: { ...GOOD_PULLDOWN, topReachFraction: 0.85, bottomWristAboveShoulderM: 0.15, seed: 3 },
  /** Shoulders ride up toward the ears instead of depressing as the bar comes down. */
  shrug: { ...GOOD_PULLDOWN, shoulderElevationTopM: 0.03, shoulderElevationBottomM: 0.05, seed: 4 },
  /** Bar is let go on the way up instead of being lowered under control. */
  fast_eccentric: { ...GOOD_PULLDOWN, eccentricS: 0.5, seed: 5 },
  /** Right arm finishes short of the left. */
  asymmetric: { ...GOOD_PULLDOWN, rightHandLagM: 0.08, seed: 6 },
} satisfies Record<string, PulldownProfile>;
export type PulldownVariant = keyof typeof PULLDOWN_VARIANTS;

/** Made-up anthropometrics for a ~1.75 m lifter, meters. */
const BODY = {
  trunk: 0.5, // hip midpoint to shoulder midpoint
  shoulderHalfWidth: 0.2,
  hipHalfWidth: 0.1,
  upperArm: 0.3,
  forearm: 0.27,
  thigh: 0.43,
  shin: 0.43,
  gripHalfWidth: 0.37, // wide overhand grip
  barAheadOfShoulders: 0.12,
};

const FPS = 30;
const IMAGE = { width: 720, height: 1280 };

const rad = (d: number) => (d * Math.PI) / 180;
const ease = (p: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, p)))) / 2;

/** Bar travel at time t: 0 = top (arms overhead), 1 = bottom (bar at the chest). */
export function barProgressAt(t: number, p: PulldownProfile): number {
  const repS = p.concentricS + p.bottomPauseS + p.eccentricS + p.topPauseS;
  const tt = t - p.leadS;
  if (tt < 0 || tt >= repS * p.reps) return 0;
  let r = tt % repS;
  if (r < p.concentricS) return ease(r / p.concentricS);
  r -= p.concentricS;
  if (r < p.bottomPauseS) return 1;
  r -= p.bottomPauseS;
  if (r < p.eccentricS) return 1 - ease(r / p.eccentricS);
  return 0;
}

export function clipSeconds(p: PulldownProfile): number {
  return p.leadS + p.reps * (p.concentricS + p.bottomPauseS + p.eccentricS + p.topPauseS) + 0.3;
}

/**
 * Body frame: l = toward the lifter's left, u = up, f = forward (the way the lifter faces). Origin at the hip midpoint.
 * The lifter sits with thighs horizontal under the knee pad and the cable straight overhead.
 */
type Body = Record<PoseLandmarkName, Vec3>;

/** Two-link arm: elbow position for a shoulder and wrist, bending toward `pole`. Clamps unreachable targets. */
function solveElbow(shoulder: Vec3, wrist: Vec3, pole: Vec3): { elbow: Vec3; wrist: Vec3 } {
  const a = BODY.upperArm;
  const b = BODY.forearm;
  const sw = sub(wrist, shoulder);
  const d = Math.min(norm(sw), (a + b) * 0.999);
  const u = unit(sw);
  const w = add(shoulder, scale(u, d));
  const x = (a * a - b * b + d * d) / (2 * d);
  const r = Math.sqrt(Math.max(0, a * a - x * x));
  const side = unit(rejectFrom(pole, u));
  return { elbow: add(add(shoulder, scale(u, x)), scale(side, r)), wrist: w };
}

function shoulderMidAt(leanDeg: number): Vec3 {
  return v(0, BODY.trunk * Math.cos(rad(leanDeg)), -BODY.trunk * Math.sin(rad(leanDeg)));
}

/** Full 33-point pose in the body frame for bar progress `prog`. */
export function poseAt(prog: number, p: PulldownProfile): Body {
  const L = v(1, 0, 0);
  const U = v(0, 1, 0);
  const F = v(0, 0, 1);
  const lean = p.trunkLeanDeg + p.trunkSwingDeg * prog;
  const trunkAxis = unit(shoulderMidAt(lean));
  const elevation = p.shoulderElevationTopM + (p.shoulderElevationBottomM - p.shoulderElevationTopM) * prog;
  const shoulderMid = add(shoulderMidAt(lean), scale(trunkAxis, elevation));
  const neckBase = shoulderMidAt(lean); // head does not move with the shoulder girdle

  // Bar path is fixed in space: straight down the cable line, in front of where the shoulders start.
  const startShoulder = add(shoulderMidAt(p.trunkLeanDeg), scale(unit(shoulderMidAt(p.trunkLeanDeg)), p.shoulderElevationTopM));
  const barF = startShoulder.z + BODY.barAheadOfShoulders;
  const lateral = BODY.gripHalfWidth - BODY.shoulderHalfWidth;
  const reach = p.topReachFraction * (BODY.upperArm + BODY.forearm);
  const topU = startShoulder.y + Math.sqrt(Math.max(0, reach ** 2 - lateral ** 2 - BODY.barAheadOfShoulders ** 2));
  const endLean = p.trunkLeanDeg + p.trunkSwingDeg;
  const endShoulder = add(shoulderMidAt(endLean), scale(unit(shoulderMidAt(endLean)), p.shoulderElevationBottomM));
  const bottomU = endShoulder.y + p.bottomWristAboveShoulderM;
  const barU = topU + (bottomU - topU) * prog;

  const pose = {} as Body;
  for (const [side, s] of [["left", 1], ["right", -1]] as const) {
    const shoulder = add(shoulderMid, scale(L, s * BODY.shoulderHalfWidth));
    const lag = side === "right" ? p.rightHandLagM * prog : 0;
    const wristTarget = v(s * BODY.gripHalfWidth, barU + lag, barF);
    const pole = add(add(scale(L, s), scale(U, -1)), scale(F, -0.3)); // elbows out, down and slightly back
    const { elbow, wrist } = solveElbow(shoulder, wristTarget, pole);
    const forearmDir = unit(sub(wrist, elbow));
    const thumbSide = scale(L, -s); // overhand grip: thumbs point toward the midline
    pose[`${side}_shoulder`] = shoulder;
    pose[`${side}_elbow`] = elbow;
    pose[`${side}_wrist`] = wrist;
    pose[`${side}_index`] = add(wrist, scale(forearmDir, 0.09));
    pose[`${side}_pinky`] = add(add(wrist, scale(forearmDir, 0.08)), scale(thumbSide, -0.03));
    pose[`${side}_thumb`] = add(add(wrist, scale(forearmDir, 0.05)), scale(thumbSide, 0.03));

    const hip = scale(L, s * BODY.hipHalfWidth);
    const knee = add(hip, scale(F, BODY.thigh));
    const ankle = add(add(knee, scale(U, -BODY.shin)), scale(F, 0.05));
    pose[`${side}_hip`] = hip;
    pose[`${side}_knee`] = knee;
    pose[`${side}_ankle`] = ankle;
    pose[`${side}_heel`] = add(ankle, v(0, -0.03, -0.05));
    pose[`${side}_foot_index`] = add(ankle, v(0, -0.05, 0.15));
  }

  // Head rides on the trunk. Its "forward" is the trunk's forward tilted with the lean.
  const headF = unit(cross(L, trunkAxis)); // L × up-ish = forward
  const head = add(neckBase, scale(trunkAxis, 0.17));
  const at = (l: number, u: number, f: number) => add(add(add(head, scale(L, l)), scale(trunkAxis, u)), scale(headF, f));
  pose.nose = at(0, 0, 0.1);
  for (const [side, s] of [["left", 1], ["right", -1]] as const) {
    pose[`${side}_eye_inner`] = at(s * 0.02, 0.03, 0.085);
    pose[`${side}_eye`] = at(s * 0.035, 0.03, 0.08);
    pose[`${side}_eye_outer`] = at(s * 0.05, 0.03, 0.075);
    pose[`${side}_ear`] = at(s * 0.075, 0, 0);
  }
  pose.mouth_left = at(0.025, -0.04, 0.09);
  pose.mouth_right = at(-0.025, -0.04, 0.09);
  return pose;
}

/** Body frame → MediaPipe world axes (x = image right, y = down, z = away from the camera). */
function toWorld(b: Vec3, view: CameraView): Vec3 {
  // frontal: lifter faces the camera, so their left is image right. sagittal: faces image right, left side nearest.
  return view === "frontal" ? v(b.x, -b.y, -b.z) : v(b.z, -b.y, -b.x);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Builds a PoseSequence (33 image + 33 world landmarks per frame) for a synthetic pulldown set. */
export function synthesizePulldown(
  profile: PulldownProfile,
  options: { cameraView?: CameraView; id?: string } = {},
): PoseSequence {
  const view = options.cameraView ?? "frontal";
  const rand = mulberry32(profile.seed);
  const n = Math.round(clipSeconds(profile) * FPS);
  const frameHeightM = 2.0;
  const frames = [];
  for (let i = 0; i < n; i++) {
    const pose = poseAt(barProgressAt(i / FPS, profile), profile);
    const world = POSE_LANDMARK_NAMES.map((name) => {
      const w = toWorld(pose[name], view);
      const jitter = () => gaussian(rand) * profile.noiseM;
      return add(w, v(jitter(), jitter(), jitter()));
    });
    const visibility = (name: PoseLandmarkName) => (view === "sagittal" && name.startsWith("right_") ? 0.6 : 0.95);
    frames.push({
      frameIndex: i,
      timestampMs: Math.round((i * 1000) / FPS),
      landmarks: world.map((w, k) => ({
        x: r5(0.5 + w.x / (frameHeightM * (IMAGE.width / IMAGE.height))),
        y: r5(0.62 + w.y / frameHeightM),
        z: r5(w.z / frameHeightM),
        visibility: visibility(POSE_LANDMARK_NAMES[k]!),
      })),
      worldLandmarks: world.map((w, k) => ({
        x: r5(w.x),
        y: r5(w.y),
        z: r5(w.z),
        visibility: visibility(POSE_LANDMARK_NAMES[k]!),
      })),
    });
  }
  return PoseSequence.parse({
    id: options.id ?? `synthetic-lat-pulldown-${view}`,
    exerciseId: "lat_pulldown",
    cameraView: view,
    fps: FPS,
    image: IMAGE,
    source: "fixture",
    frames,
  });
}

/** Sanity helper for tests: segment lengths should stay constant across frames. */
export function segmentLength(seq: PoseSequence, frame: number, a: PoseLandmarkName, b: PoseLandmarkName): number {
  const f = seq.frames[frame]!;
  const ia = POSE_LANDMARK_NAMES.indexOf(a);
  const ib = POSE_LANDMARK_NAMES.indexOf(b);
  return dist(f.worldLandmarks[ia]!, f.worldLandmarks[ib]!);
}
