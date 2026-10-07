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
  /** Where the pull line passes, ahead of the starting shoulders at shoulder height (m). Smaller = bar closer to the
   *  body, so the arms finish the top more overhead (more shoulder flexion). */
  lineAheadOfShouldersM: number;
  /** Pull line: the bar travels down a straight line tilted this far from vertical (top end forward). Tony: 12-15°. */
  pullLineDeg: number;
  /** Pulley (where the cable leaves the machine): height above the hips and distance ahead of the knees (m). The
   *  cable runs from the bar to here, so it is the direction the force pulls the hands. Tony: above the knees. */
  pulleyAboveHipM: number;
  pulleyAheadOfKneeM: number;
  /**
   * How far the arms come down at the bottom: upper arm angle from the trunk's downward axis (0 = against the sides).
   * Lower = more adduction. Seen from the side the forearm stays on the cable line until the last quarter of the pull,
   * then breaks off it (elbows dropping behind) by whatever angle lands the arms here at the trunk-line stop point.
   * Less break = arms finish lower; a break of 0 is the lowest the forearm-on-line pull can reach.
   */
  bottomArmElevationDeg: number;
  /**
   * Hold the forearm on the pull line (side view) as above. Off for the elbows-forward pull: with a close grip the
   * forearm can only stay on the line by flaring the elbow out, so there the elbow just bends toward its pole.
   */
  forearmOnLine: boolean;
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
   * Hand spacing on the bar as a multiple of shoulder width (wrist to wrist ÷ shoulder to shoulder).
   * Default overhand grip 2.0× (Tony, 2026-10-07); close grip ≈ 1.1×. For a given bar depth a wider grip needs less elbow bend.
   */
  gripWidthXShoulder: number;
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
  trunkLeanDeg: 8,
  trunkSwingDeg: 4,
  topElbowFlexionDeg: 5,
  pullLineDeg: 13.5,
  lineAheadOfShouldersM: 0.09,
  pulleyAboveHipM: 1.6,
  pulleyAheadOfKneeM: 0,
  bottomArmElevationDeg: 50,
  forearmOnLine: true,
  bottomHumerusBehindDeg: 5,
  shoulderElevationTopM: 0.03,
  shoulderElevationBottomM: -0.02,
  gripWidthXShoulder: 2.0,
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
  momentum_swing: { ...GOOD_PULLDOWN, concentricS: 0.6, trunkLeanDeg: 10, trunkSwingDeg: 28, bottomHumerusBehindDeg: 0, seed: 2 },
  /** Elbows never straighten at the top and the bar stops around the chin. */
  partial_rom: { ...GOOD_PULLDOWN, topElbowFlexionDeg: 40, bottomHumerusBehindDeg: -8, seed: 3 },
  /** Shoulders ride up toward the ears instead of depressing as the bar comes down. */
  shrug: { ...GOOD_PULLDOWN, shoulderElevationTopM: 0.03, shoulderElevationBottomM: 0.05, seed: 4 },
  /** Pulls past the trunk line: the whole arm rotates back around the shoulder at the bottom (the old default). */
  over_pull: { ...GOOD_PULLDOWN, bottomHumerusBehindDeg: 28, seed: 9 },
  /** Bar is let go on the way up instead of being lowered under control. */
  fast_eccentric: { ...GOOD_PULLDOWN, eccentricS: 0.5, seed: 5 },
  /** Closer grip with the elbows travelling in front of the body: more shoulder extension, less adduction. */
  elbows_forward: { ...GOOD_PULLDOWN, gripWidthXShoulder: 1.1, elbowsForward: 1, forearmOnLine: false, seed: 8 },
  /** Chin pokes forward as the bar comes down. */
  forward_head: { ...GOOD_PULLDOWN, headForwardM: 0.06, seed: 7 },
  /** Right arm finishes short of the left. */
  asymmetric: { ...GOOD_PULLDOWN, rightHandLagM: 0.05, seed: 6 },
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

const gripHalfWidth = (p: PulldownProfile) => p.gripWidthXShoulder * BODY.shoulderHalfWidth;

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

/** Unit vector pointing up the pull line (toward the pulley): tilted pullLineDeg forward of vertical. */
const pullDir = (p: PulldownProfile) => v(0, Math.cos(rad(p.pullLineDeg)), Math.sin(rad(p.pullLineDeg)));

/** Where the bar sits on the pull line: `t` meters up the line from the point level with the starting shoulders. */
function barOnLine(p: PulldownProfile, t: number): Vec3 {
  const start = add(shoulderMidAt(p.trunkLeanDeg), scale(unit(shoulderMidAt(p.trunkLeanDeg)), p.shoulderElevationTopM));
  return add(v(0, start.y, start.z + p.lineAheadOfShouldersM), scale(pullDir(p), t));
}

/** How far the forearm tilts off the cable line (seen from the side) at bar progress `prog`: 0 until the last part of
 *  the pull, then easing into `breakDeg`. */
function forearmOffLineAt(prog: number, breakDeg: number): number {
  const x = Math.min(1, Math.max(0, (prog - (1 - FOREARM_BREAK_FRACTION)) / FOREARM_BREAK_FRACTION));
  return breakDeg * x * x * (3 - 2 * x);
}
/** Share of the bar's travel, at the bottom, over which the forearm leaves the pull line. */
const FOREARM_BREAK_FRACTION = 0.25;

/**
 * Elbow for a shoulder and wrist with the forearm held on the cable line: seen from the side, the forearm points along
 * `dir`, tilted `offLineDeg` forward of it (+ = elbow dropping behind the line). The elbow lies on a circle around the
 * shoulder–wrist axis; of the (up to two) points meeting the condition, the one nearer `pole` is used.
 */
function solveElbowOnLine(shoulder: Vec3, wrist: Vec3, dir: Vec3, offLineDeg: number, pole: Vec3): { elbow: Vec3; wrist: Vec3 } {
  const a = BODY.upperArm;
  const b = BODY.forearm;
  const sw = sub(wrist, shoulder);
  const d = Math.min(norm(sw), (a + b) * 0.999);
  const u = unit(sw);
  const w = add(shoulder, scale(u, d));
  const x = (a * a - b * b + d * d) / (2 * d);
  const r = Math.sqrt(Math.max(0, a * a - x * x));
  const c = add(shoulder, scale(u, x));
  const e1 = unit(rejectFrom(pole, u));
  const e2 = cross(u, e1);
  const n = v(0, -dir.z, dir.y); // in the side view, perpendicular to the line, pointing forward
  // dot(w - elbow, n) = b sin(off)  ⇔  A cos ψ + B sin ψ = K, elbow = c + r (cos ψ e1 + sin ψ e2)
  const A = r * dot(e1, n);
  const B = r * dot(e2, n);
  const K = dot(sub(w, c), n) - b * Math.sin(rad(offLineDeg));
  const R = Math.hypot(A, B);
  const base = Math.atan2(B, A);
  const spread = R < 1e-9 ? 0 : Math.acos(Math.max(-1, Math.min(1, K / R)));
  // ψ = 0 is the pole direction; take the solution closest to it.
  const wrapPi = (t: number) => Math.atan2(Math.sin(t), Math.cos(t));
  const psi = [base + spread, base - spread].map(wrapPi).sort((p1, p2) => Math.abs(p1) - Math.abs(p2))[0]!;
  return { elbow: add(c, add(scale(e1, r * Math.cos(psi)), scale(e2, r * Math.sin(psi)))), wrist: w };
}

interface BarTravel {
  top: number;
  bottom: number;
  /** Forearm break off the cable line at the bottom (degrees), solved from bottomArmElevationDeg. */
  breakDeg: number;
}
// Keyed by the profile's values, not the object: callers (Motion Lab's sliders) edit profiles in place.
const barCache = new Map<string, BarTravel>();
const BAR_CACHE_MAX = 64;

/** Upper arm angle from the trunk's downward axis (0 = arm against the side), left arm, body frame. */
function armElevationDeg(pose: Body, leanDeg: number): number {
  const down = v(0, -Math.cos(rad(leanDeg)), Math.sin(rad(leanDeg)));
  const h = sub(pose.left_elbow, pose.left_shoulder);
  return (Math.acos(Math.max(-1, Math.min(1, dot(h, down) / norm(h)))) * 180) / Math.PI;
}

/**
 * Walks down the line from the top until the upper arm is bottomHumerusBehindDeg behind the trunk; if it never gets
 * there (the forearm-on-line constraint caps how far back the elbow can go), stops where it gets furthest back.
 */
function stopOnLine(p: PulldownProfile, top: number, breakDeg: number, endLean: number): number {
  const behindAt = (t: number) => humerusBehindDeg(poseWithBar(1, p, top, t, breakDeg), endLean) - p.bottomHumerusBehindDeg;
  let bestT = top;
  let best = behindAt(top);
  for (let t = top - 0.005; t >= -0.7; t -= 0.005) {
    const err = behindAt(t);
    if (err >= 0) {
      let lo = t;
      let hi = t + 0.005;
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        if (behindAt(m) >= 0) lo = m;
        else hi = m;
      }
      return (lo + hi) / 2;
    }
    if (err > best) {
      best = err;
      bestT = t;
    }
  }
  return bestT;
}
/**
 * Where the bar starts and finishes on the pull line (`t`, see barOnLine). Top: shoulder-to-wrist distance gives
 * `topElbowFlexionDeg` (bisection). Bottom: the trunk-line stop point (stopOnLine), with the forearm break chosen so the
 * arms finish at `bottomArmElevationDeg`.
 */
export function barTravelFor(p: PulldownProfile): BarTravel {
  const key = JSON.stringify(p);
  const cached = barCache.get(key);
  if (cached) return cached;
  if (barCache.size >= BAR_CACHE_MAX) barCache.clear();
  const startShoulder = add(shoulderMidAt(p.trunkLeanDeg), scale(unit(shoulderMidAt(p.trunkLeanDeg)), p.shoulderElevationTopM));
  const leftShoulder = add(startShoulder, v(BODY.shoulderHalfWidth, 0, 0));
  const grip = v(gripHalfWidth(p), 0, 0);
  const reach = reachForFlexion(p.topElbowFlexionDeg);
  let lo = 0;
  let hi = 1.2;
  for (let i = 0; i < 50; i++) {
    const t = (lo + hi) / 2;
    if (dist(add(barOnLine(p, t), grip), leftShoulder) > reach) hi = t;
    else lo = t;
  }
  const top = (lo + hi) / 2;
  const endLean = p.trunkLeanDeg + p.trunkSwingDeg;
  const bottomFor = (breakDeg: number) => stopOnLine(p, top, breakDeg, endLean);
  if (!p.forearmOnLine) {
    const travel = { top, bottom: bottomFor(0), breakDeg: 0 };
    barCache.set(key, travel);
    return travel;
  }
  // More forearm break → the elbow reaches the stop point sooner, with the arms higher. Bisect the break that lands the
  // arms at bottomArmElevationDeg (0-60 deg of break; at 0 the arms are as low as this pull allows).
  const elevationFor = (breakDeg: number) => armElevationDeg(poseWithBar(1, p, top, bottomFor(breakDeg), breakDeg), endLean);
  let breakDeg = 0;
  if (elevationFor(0) < p.bottomArmElevationDeg) {
    let blo = 0;
    let bhi = 60;
    for (let i = 0; i < 25; i++) {
      const m = (blo + bhi) / 2;
      if (elevationFor(m) < p.bottomArmElevationDeg) blo = m;
      else bhi = m;
    }
    breakDeg = (blo + bhi) / 2;
  }
  const travel = { top, bottom: bottomFor(breakDeg), breakDeg };
  barCache.set(key, travel);
  return travel;
}

/** Full 33-point pose in the body frame for bar progress `prog`. */
export function poseAt(prog: number, p: PulldownProfile): Body {
  const { top, bottom, breakDeg } = barTravelFor(p);
  return poseWithBar(prog, p, top, bottom, breakDeg);
}

function poseWithBar(prog: number, p: PulldownProfile, topT: number, bottomT: number, breakDeg: number): Body {
  const L = v(1, 0, 0);
  const U = v(0, 1, 0);
  const F = v(0, 0, 1);
  const lean = p.trunkLeanDeg + p.trunkSwingDeg * prog;
  const trunkAxis = unit(shoulderMidAt(lean));
  const elevation = p.shoulderElevationTopM + (p.shoulderElevationBottomM - p.shoulderElevationTopM) * prog;
  const shoulderMid = add(shoulderMidAt(lean), scale(trunkAxis, elevation));
  const neckBase = shoulderMidAt(lean); // head does not move with the shoulder girdle

  // The bar runs down the pull line (fixed in the room, pullLineDeg off vertical) from top to bottom.
  const t = topT + (bottomT - topT) * prog;
  // Forearms line up with the force, i.e. the cable from the bar to the pulley above the knees.
  const pulley = v(0, p.pulleyAboveHipM, BODY.thigh + p.pulleyAheadOfKneeM);
  const dir = unit(sub(pulley, barOnLine(p, t)));
  const offLine = forearmOffLineAt(prog, breakDeg);

  const pose = {} as Body;
  for (const [side, s] of [["left", 1], ["right", -1]] as const) {
    const shoulder = add(shoulderMid, scale(L, s * BODY.shoulderHalfWidth));
    const lag = side === "right" ? p.rightHandLagM * prog : 0;
    const wristTarget = add(barOnLine(p, t + lag), v(s * gripHalfWidth(p), 0, 0));
    // Elbows bend toward the pole: out, down and slightly back by default; forward as elbowsForward → 1.
    const k = p.elbowsForward;
    const pole = add(add(scale(L, s * (1 - k)), scale(U, -1)), scale(F, -0.3 + 1.3 * k));
    const { elbow, wrist } = p.forearmOnLine
      ? solveElbowOnLine(shoulder, wristTarget, dir, offLine, pole)
      : solveElbow(shoulder, wristTarget, pole);
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
