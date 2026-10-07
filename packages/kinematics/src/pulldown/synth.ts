// Synthetic lat pulldown clips: a 3D stick figure posed in MediaPipe's 33-landmark layout.
// These exist to exercise the math and to try out parameter values. They are NOT recordings and NOT a clinical
// reference: every body dimension and motion value below is a made-up default chosen to look like a plausible rep.
import { POSE_LANDMARK_NAMES, type PoseLandmarkName, type PoseSequence } from "@optimass/types";
import { standardExerciseCamera, type CameraPlacement } from "../camera";
import { renderSequence, type Body } from "../synth-render";
import { add, cross, dist, dot, norm, rejectFrom, scale, sub, unit, v, type Vec3 } from "../vec3";

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
  /** Elbow flexion at the top (0 = elbows locked out). */
  topElbowFlexionDeg: number;
  /** Elbow flexion at the bottom. Together with bottomHumerusBehindDeg it sets where the bar finishes. */
  bottomElbowFlexionDeg: number;
  /**
   * Where the pull stops: upper arm angle behind the trunk's frontal plane at the bottom (0 = elbow level with the
   * trunk line, + = elbow behind the body, the whole arm rotating back around the shoulder; − = elbow still in front).
   * The bar's bottom height is solved to hit it.
   */
  bottomHumerusBehindDeg: number;
  /** Shoulder girdle elevation along the trunk at the top and the bottom (positive = toward the ears). */
  shoulderElevationTopM: number;
  shoulderElevationBottomM: number;
  /**
   * Half the distance between the hands on the bar (m). Wide overhand ≈ 0.46 (≈ 92 cm between hands), close ≈ 0.22.
   * For a given bar depth a wider grip needs less elbow bend.
   */
  gripHalfWidthM: number;
  /** Where the elbows point as they bend: 0 = out to the sides, 1 = forward. Moves the pull from adduction to extension. */
  elbowsForward: number;
  /** Head (ears) drifts this far forward of the shoulders, perpendicular to the trunk, as the bar comes down. */
  headForwardM: number;
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
  topElbowFlexionDeg: 15,
  bottomElbowFlexionDeg: 110,
  bottomHumerusBehindDeg: 5,
  shoulderElevationTopM: 0.03,
  shoulderElevationBottomM: -0.02,
  gripHalfWidthM: 0.46,
  elbowsForward: 0,
  headForwardM: 0,
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
  partial_rom: { ...GOOD_PULLDOWN, topElbowFlexionDeg: 50, bottomElbowFlexionDeg: 95, bottomHumerusBehindDeg: -10, seed: 3 },
  /** Shoulders ride up toward the ears instead of depressing as the bar comes down. */
  shrug: { ...GOOD_PULLDOWN, shoulderElevationTopM: 0.03, shoulderElevationBottomM: 0.05, seed: 4 },
  /** Pulls past the trunk line: the whole arm rotates back around the shoulder at the bottom (the old default). */
  over_pull: { ...GOOD_PULLDOWN, bottomHumerusBehindDeg: 28, seed: 9 },
  /** Bar is let go on the way up instead of being lowered under control. */
  fast_eccentric: { ...GOOD_PULLDOWN, eccentricS: 0.5, seed: 5 },
  /** Closer grip with the elbows travelling in front of the body: more shoulder extension, less adduction. */
  elbows_forward: { ...GOOD_PULLDOWN, gripHalfWidthM: 0.22, elbowsForward: 1, bottomElbowFlexionDeg: 145, seed: 8 },
  /** Chin pokes forward as the bar comes down. */
  forward_head: { ...GOOD_PULLDOWN, headForwardM: 0.06, seed: 7 },
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
  barAheadOfShoulders: 0.12,
};

const FPS = 30;

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

// Body frame: x = toward the lifter's left, y = up, z = forward (the way the lifter faces). Origin at the hip midpoint.
// The lifter sits with thighs horizontal under the knee pad and the cable straight overhead.


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

/** Upper arm angle behind the trunk's frontal plane (degrees, + = elbow behind), left arm, body frame. */
function humerusBehindDeg(pose: Body, leanDeg: number): number {
  const fwd = v(0, Math.sin(rad(leanDeg)), Math.cos(rad(leanDeg))); // trunk forward, perpendicular to the lean
  const h = sub(pose.left_elbow, pose.left_shoulder);
  return (Math.asin(-dot(h, fwd) / norm(h)) * 180) / Math.PI;
}

/** Shoulder-to-wrist distance for an elbow flexion angle (0 = straight arm). */
function reachForFlexion(flexionDeg: number): number {
  const a = BODY.upperArm;
  const b = BODY.forearm;
  return Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(rad(flexionDeg)));
}

/** Bar position at the bottom in the body frame: height (y) and depth (z) of the wrists. */
export interface BarBottom {
  u: number;
  f: number;
}

const barBottomCache = new WeakMap<PulldownProfile, BarBottom>();
/**
 * Where the bar must finish so the elbow is bent `bottomElbowFlexionDeg` and the upper arm sits
 * `bottomHumerusBehindDeg` behind the trunk. Elbow flexion fixes the shoulder-to-wrist distance, so the wrist lies on a
 * circle beside the shoulder; this walks that circle from up and behind to straight down and takes the
 * point that puts the elbow at the target, preferring the straightest bar path.
 */
export function barBottomFor(p: PulldownProfile): BarBottom {
  const cached = barBottomCache.get(p);
  if (cached) return cached;
  const endLean = p.trunkLeanDeg + p.trunkSwingDeg;
  const endAxis = unit(shoulderMidAt(endLean));
  const shoulder = add(shoulderMidAt(endLean), scale(endAxis, p.shoulderElevationBottomM));
  const lateral = p.gripHalfWidthM - BODY.shoulderHalfWidth;
  const d = reachForFlexion(p.bottomElbowFlexionDeg);
  const r = Math.sqrt(Math.max(1e-6, d * d - lateral * lateral));
  const at = (phiDeg: number): BarBottom => ({ u: shoulder.y + r * Math.cos(rad(phiDeg)), f: shoulder.z + r * Math.sin(rad(phiDeg)) });
  // Several points on the circle can hit the target angle; take the one closest to the cable line (straightest bar path).
  const cableF = shoulderMidAt(p.trunkLeanDeg).z + BODY.barAheadOfShoulders;
  let best = at(0);
  let bestScore = Number.POSITIVE_INFINITY;
  let prev = Number.NaN;
  for (let phi = -60; phi <= 180; phi += 0.25) {
    const b = at(phi);
    const pose = poseWithBar(1, p, b);
    const err = humerusBehindDeg(pose, endLean) - p.bottomHumerusBehindDeg;
    const crossed = !Number.isNaN(prev) && Math.sign(err) !== Math.sign(prev);
    // Fallback score for an unreachable target is the angle miss; real crossings always win.
    const score = crossed ? Math.abs(b.f - cableF) : 1e3 + Math.abs(err);
    if (score < bestScore) {
      best = b;
      bestScore = score;
    }
    prev = err;
  }
  barBottomCache.set(p, best);
  return best;
}

/** Full 33-point pose in the body frame for bar progress `prog`. */
export function poseAt(prog: number, p: PulldownProfile): Body {
  return poseWithBar(prog, p, barBottomFor(p));
}

function poseWithBar(prog: number, p: PulldownProfile, bottom: BarBottom): Body {
  const L = v(1, 0, 0);
  const U = v(0, 1, 0);
  const F = v(0, 0, 1);
  const lean = p.trunkLeanDeg + p.trunkSwingDeg * prog;
  const trunkAxis = unit(shoulderMidAt(lean));
  const elevation = p.shoulderElevationTopM + (p.shoulderElevationBottomM - p.shoulderElevationTopM) * prog;
  const shoulderMid = add(shoulderMidAt(lean), scale(trunkAxis, elevation));
  const neckBase = shoulderMidAt(lean); // head does not move with the shoulder girdle

  // Top: on the cable line in front of where the shoulders start, with the elbows bent topElbowFlexionDeg.
  // The bar then travels in a straight line to the solved bottom position.
  const startShoulder = add(shoulderMidAt(p.trunkLeanDeg), scale(unit(shoulderMidAt(p.trunkLeanDeg)), p.shoulderElevationTopM));
  const topF = startShoulder.z + BODY.barAheadOfShoulders;
  const lateral = p.gripHalfWidthM - BODY.shoulderHalfWidth;
  const reach = reachForFlexion(p.topElbowFlexionDeg) * 0.999;
  const topU = startShoulder.y + Math.sqrt(Math.max(0, reach ** 2 - lateral ** 2 - BODY.barAheadOfShoulders ** 2));
  const barU = topU + (bottom.u - topU) * prog;
  const barF = topF + (bottom.f - topF) * prog;

  const pose = {} as Body;
  for (const [side, s] of [["left", 1], ["right", -1]] as const) {
    const shoulder = add(shoulderMid, scale(L, s * BODY.shoulderHalfWidth));
    const lag = side === "right" ? p.rightHandLagM * prog : 0;
    const wristTarget = v(s * p.gripHalfWidthM, barU + lag, barF);
    // Elbows bend toward the pole: out, down and slightly back by default; forward as elbowsForward → 1.
    const k = p.elbowsForward;
    const pole = add(add(scale(L, s * (1 - k)), scale(U, -1)), scale(F, -0.3 + 1.3 * k));
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
  const head = add(add(neckBase, scale(trunkAxis, 0.17)), scale(headF, p.headForwardM * prog));
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

/** Seated: hip midpoint height above the floor, and the lifter's waist (camera) height. */
export const PULLDOWN_HIP_HEIGHT_M = 0.5;
export const PULLDOWN_WAIST_HEIGHT_M = 0.65;

/** Builds a PoseSequence (33 image + 33 world landmarks per frame) for a synthetic pulldown set. */
export function synthesizePulldown(
  profile: PulldownProfile,
  options: { camera?: CameraPlacement; id?: string } = {},
): PoseSequence {
  const camera = options.camera ?? standardExerciseCamera(PULLDOWN_WAIST_HEIGHT_M);
  return renderSequence({
    id: options.id ?? `synthetic-lat-pulldown-az${camera.azimuthDeg}`,
    exerciseId: "lat_pulldown",
    fps: FPS,
    frameCount: Math.round(clipSeconds(profile) * FPS),
    poseAtFrame: (i) => poseAt(barProgressAt(i / FPS, profile), profile),
    camera,
    hipHeightM: PULLDOWN_HIP_HEIGHT_M,
    noiseM: profile.noiseM,
    seed: profile.seed,
  });
}

/** Sanity helper for tests: segment lengths should stay constant across frames. */
export function segmentLength(seq: PoseSequence, frame: number, a: PoseLandmarkName, b: PoseLandmarkName): number {
  const f = seq.frames[frame]!;
  const ia = POSE_LANDMARK_NAMES.indexOf(a);
  const ib = POSE_LANDMARK_NAMES.indexOf(b);
  return dist(f.worldLandmarks[ia]!, f.worldLandmarks[ib]!);
}
