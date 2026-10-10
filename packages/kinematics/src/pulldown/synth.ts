// Synthetic lat pulldown clips: a 3D stick figure posed in MediaPipe's 33-landmark layout.
// These exist to exercise the math and to try out parameter values. They are NOT recordings and NOT a clinical
// reference: every body dimension and motion value below is a made-up default chosen to look like a plausible rep.
import { POSE_LANDMARK_NAMES, type PoseLandmarkName, type PoseSequence } from "@optimass/types";
import { standardExerciseCamera, type CameraPlacement } from "../camera";
import { SYNTH_STATURE_M } from "../posture/synth";
import { renderSequence, type Body } from "../synth-render";
import { add, cross, dist, dot, norm, rejectFrom, scale, sub, unit, v, type Vec3 } from "../vec3";

export type PulldownGripType = "overhand" | "underhand" | "neutral";
export type PulldownAttachment = "straight_bar" | "neutral_bar";

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
  /**
   * Aim the line of pull at the pulley (Tony, 2026-10-09): the bar runs along the cable, so moving the pulley tilts the
   * line and pullLineDeg is ignored. The line still passes lineAheadOfShouldersM in front of the starting shoulders.
   */
  lineToPulley: boolean;
  /** Pulley (where the cable leaves the machine): height above the hips and distance ahead of the knees (m). The
   *  cable runs from the bar to here, so it is the direction the force pulls the hands. Tony: above the knees. */
  pulleyAboveHipM: number;
  pulleyAheadOfKneeM: number;
  /**
   * How far the arms come down at the bottom: upper arm angle from the trunk's downward axis (0 = against the sides).
   * Lower = more adduction. Seen from the side the forearm stays on the cable line until the last quarter of the pull,
   * then breaks off it (elbows dropping behind) by whatever angle lands the arms here at the trunk-line stop point.
   * Less break = arms finish lower; a break of 0 is the lowest the forearm-on-line pull can reach.
   * With free elbows (forearmOnLine false) the elbows flare out over the last quarter instead; 0 = no flare.
   */
  bottomArmElevationDeg: number;
  /**
   * Hold the forearm on the pull line (side view) as above. Off for the elbows-forward pull: with a close grip the
   * forearm can only stay on the line by flaring the elbow out, so there the elbow just bends toward its pole.
   */
  forearmOnLine: boolean;
  /** Share of the bar's travel, at the bottom, over which the forearm leaves the pull line (0.25 = the last quarter). */
  forearmBreakFraction: number;
  /**
   * With the forearm held on the cable: how far it may tilt sideways (seen from the front) before the solver trades
   * side-view alignment for an upright forearm. Lower = straighter down from the front.
   */
  forearmFrontTiltFreeDeg: number;
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
   * Scapular retraction at the top and the bottom (m): each shoulder joint glides back around the ribcage and slightly
   * toward the spine (the shoulders narrow). MediaPipe sees it as shoulders moving back and closer together.
   */
  scapularRetractionTopM: number;
  scapularRetractionBottomM: number;
  /**
   * Scapular downward rotation from the top to the bottom (deg). The shoulder joint swings down and slightly in around
   * the scapula's rotation centre. MediaPipe has no scapula points, so this only shows as extra shoulder depression.
   */
  scapularDownwardRotationDeg: number;
  /**
   * Hand spacing on the bar as a multiple of shoulder width (wrist to wrist ÷ shoulder to shoulder).
   * Default overhand grip 2.0× (Tony, 2026-10-07); close grip ≈ 1.1×. For a given bar depth a wider grip needs less elbow bend.
   */
  gripWidthXShoulder: number;
  /** Where the elbows point as they bend: 0 = out to the sides, 1 = forward. Moves the pull from adduction to extension. */
  elbowsForward: number;
  /** Hand orientation: overhand (palms forward), underhand (palms toward the face) or neutral (palms facing each other). */
  gripType: PulldownGripType;
  /** What the hands hold. Only changes the hand landmarks and how Motion Lab draws it; spacing is gripWidthXShoulder. */
  attachment: PulldownAttachment;
  /** Head (ears) drifts this far forward of the shoulders, perpendicular to the trunk, as the bar comes down. */
  headForwardM: number;
  /** Right hand stays this much higher than the left at the bottom (an uneven pull). */
  rightHandLagM: number;
  /**
   * Yanking the bar down: 0 = smooth start from the top, 1 = the bar is snapped down from a standstill (most of the
   * speed arrives in the first frames of the pull instead of building up).
   */
  yank: number;
  /** Std. dev. of per-landmark jitter added to world coordinates, mimicking estimation noise. */
  noiseM: number;
  seed: number;
}

export const GOOD_PULLDOWN: PulldownProfile = {
  reps: 3,
  leadS: 0.6,
  concentricS: 1.0,
  bottomPauseS: 0.25,
  eccentricS: 2.0,
  topPauseS: 0.25,
  trunkLeanDeg: 8,
  trunkSwingDeg: 18,
  topElbowFlexionDeg: 11,
  pullLineDeg: 14.5,
  lineToPulley: true,
  lineAheadOfShouldersM: 0.03,
  pulleyAboveHipM: 1.53,
  pulleyAheadOfKneeM: -0.22,
  bottomArmElevationDeg: 42,
  forearmOnLine: true,
  forearmBreakFraction: 0.25,
  forearmFrontTiltFreeDeg: 12,
  bottomHumerusBehindDeg: 5,
  shoulderElevationTopM: 0.03,
  shoulderElevationBottomM: -0.02,
  // PLACEHOLDER girdle motion ("slight retraction", downward rotation) until Tony tunes it in Motion Lab.
  scapularRetractionTopM: 0,
  scapularRetractionBottomM: 0.015,
  scapularDownwardRotationDeg: 20,
  gripWidthXShoulder: 2.2,
  elbowsForward: 0.5,
  gripType: "overhand",
  attachment: "straight_bar",
  headForwardM: 0,
  rightHandLagM: 0,
  yank: 0,
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
  shrug: { ...GOOD_PULLDOWN, shoulderElevationTopM: 0.03, shoulderElevationBottomM: 0.05, scapularDownwardRotationDeg: 0, seed: 4 },
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
  /** Bar is yanked down from the top instead of the pull building speed smoothly. */
  yank: { ...GOOD_PULLDOWN, yank: 1, seed: 10 },
} satisfies Record<string, PulldownProfile>;
export type PulldownVariant = keyof typeof PULLDOWN_VARIANTS;

/**
 * Pulldown variations (grip and attachment). wide_overhand is Tony's baseline; the others are PLACEHOLDER starting
 * points for Tony to tune in Motion Lab and paste back. Underhand keeps the forearms on the cable line (Tony, 2026-10-09)
 * (see below). Tony dropped the
 * V-handle (2026-10-09).
 */
export const PULLDOWN_SETUPS = {
  wide_overhand: GOOD_PULLDOWN,
  // Tony (2026-10-09): forearms stay on the cable the whole way, the bar stops short of the chest. That works for close
  // grips when the line of pull tilts forward (16°) toward a pulley over or past the knees: forearms stay within ~13° of
  // the cable from the side and the front, the bar stops near collarbone height, elbows at the trunk line. Grip, trunk
  // and tempo come from Tony's underhand clip (one lifter, 2 reps, MediaPipe); its lifter broke the forearm off the
  // cable early instead.
  narrow_underhand: {
    ...GOOD_PULLDOWN,
    gripType: "underhand",
    gripWidthXShoulder: 1.1,
    // Elbows bend forward, not out: forearms straight down from the front for the whole pull (Tony, 2026-10-10).
    elbowsForward: 1,
    forearmOnLine: true,
    forearmFrontTiltFreeDeg: 3,
    bottomArmElevationDeg: 0,
    bottomHumerusBehindDeg: -5,
    topElbowFlexionDeg: 18,
    lineAheadOfShouldersM: 0.27,
    trunkLeanDeg: 15,
    trunkSwingDeg: 9.5,
    concentricS: 1.8,
    eccentricS: 3,
    bottomPauseS: 1,
    topPauseS: 0.5,
  },
  neutral_bar: {
    ...GOOD_PULLDOWN,
    gripType: "neutral",
    attachment: "neutral_bar",
    bottomArmElevationDeg: 0,
    gripWidthXShoulder: 1.5,
    elbowsForward: 0.8,
    forearmOnLine: true,
    lineAheadOfShouldersM: 0.16,
  },
} satisfies Record<string, PulldownProfile>;
export type PulldownSetup = keyof typeof PULLDOWN_SETUPS;

/**
 * A fault variant performed on a variation: the variation's profile plus whatever the fault changes from the good rep.
 * A fault that changes the grip itself (elbows_forward) keeps its own grip.
 */
export function pulldownProfileFor(setup: PulldownSetup, variant: PulldownVariant = "good"): PulldownProfile {
  const fault: Partial<PulldownProfile> = {};
  const good = GOOD_PULLDOWN as unknown as Record<string, unknown>;
  for (const [k, val] of Object.entries(PULLDOWN_VARIANTS[variant])) if (val !== good[k]) (fault as Record<string, unknown>)[k] = val;
  return { ...PULLDOWN_SETUPS[setup], ...fault };
}

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
/** The synthetic lifter's arm dimensions, for the grip formula (grip.ts). */
export const PULLDOWN_SYNTH_ARMS = { shoulderWidthM: 2 * BODY.shoulderHalfWidth, upperArmM: BODY.upperArm, forearmM: BODY.forearm };


const FPS = 30;

const rad = (d: number) => (d * Math.PI) / 180;
const ease = (p: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, p)))) / 2;

/** Bar travel at time t: 0 = top (arms overhead), 1 = bottom (bar at the chest). */
export function barProgressAt(t: number, p: PulldownProfile): number {
  const repS = p.concentricS + p.bottomPauseS + p.eccentricS + p.topPauseS;
  const tt = t - p.leadS;
  if (tt < 0 || tt >= repS * p.reps) return 0;
  let r = tt % repS;
  if (r < p.concentricS) {
    const x = r / p.concentricS;
    return (1 - p.yank) * ease(x) + p.yank * (1 - (1 - x) ** 3);
  }
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

/** Shoulder joint to the scapula's rotation centre, sideways (m). Made-up anatomy for the synthetic lifter. */
const SCAPULA_ROTATION_RADIUS = 0.1;

/**
 * Shoulder joint (glenohumeral centre) for side `s` (1 = left, −1 = right) at bar progress `prog`: trunk position plus
 * shoulder girdle elevation/depression, retraction and downward rotation.
 */
function shoulderAt(p: PulldownProfile, prog: number, leanDeg: number, s: 1 | -1): Vec3 {
  const L = v(1, 0, 0);
  const trunkAxis = unit(shoulderMidAt(leanDeg));
  const trunkFwd = unit(cross(L, trunkAxis));
  const lerp = (a: number, b: number) => a + (b - a) * prog;
  const elevation = lerp(p.shoulderElevationTopM, p.shoulderElevationBottomM);
  const retraction = lerp(p.scapularRetractionTopM, p.scapularRetractionBottomM);
  const rot = rad(p.scapularDownwardRotationDeg * prog);
  const out = BODY.shoulderHalfWidth - 0.4 * retraction - SCAPULA_ROTATION_RADIUS * (1 - Math.cos(rot));
  const up = elevation - SCAPULA_ROTATION_RADIUS * Math.sin(rot);
  return add(add(add(shoulderMidAt(leanDeg), scale(trunkAxis, up)), scale(trunkFwd, -retraction)), scale(L, s * out));
}
const shoulderMidOf = (p: PulldownProfile, prog: number, leanDeg: number) =>
  scale(add(shoulderAt(p, prog, leanDeg, 1), shoulderAt(p, prog, leanDeg, -1)), 0.5);

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

/** The pulley in the body frame: pulleyAboveHipM over the hips, pulleyAheadOfKneeM ahead of the knees. */
const pulleyOf = (p: PulldownProfile) => v(0, p.pulleyAboveHipM, BODY.thigh + p.pulleyAheadOfKneeM);
/** Point on the pull line level with the starting shoulders. */
function lineAnchor(p: PulldownProfile): Vec3 {
  const start = shoulderMidOf(p, 0, p.trunkLeanDeg);
  return v(0, start.y, start.z + p.lineAheadOfShouldersM);
}
/** Unit vector pointing up the pull line: at the pulley (lineToPulley), else tilted pullLineDeg forward of vertical. */
const pullDir = (p: PulldownProfile) =>
  p.lineToPulley ? unit(sub(pulleyOf(p), lineAnchor(p))) : v(0, Math.cos(rad(p.pullLineDeg)), Math.sin(rad(p.pullLineDeg)));
/** The line of pull's tilt from vertical (degrees, + = top ahead), whichever way it's set. */
export function pullLineDegOf(p: PulldownProfile): number {
  const d = pullDir(p);
  return (Math.atan2(d.z, d.y) * 180) / Math.PI;
}

/** Where the bar sits on the pull line: `t` meters up the line from the point level with the starting shoulders. */
function barOnLine(p: PulldownProfile, t: number): Vec3 {
  return add(lineAnchor(p), scale(pullDir(p), t));
}

/** How far the forearm tilts off the cable line (seen from the side) at bar progress `prog`: 0 until the last part of
 *  the pull, then easing into `breakDeg`. */
function forearmOffLineAt(prog: number, breakDeg: number, fraction: number): number {
  const f = Math.min(1, Math.max(0.05, fraction));
  const x = Math.min(1, Math.max(0, (prog - (1 - f)) / f));
  return breakDeg * x * x * (3 - 2 * x);
}
/**
 * Share of the bar's travel, at the top, over which the elbow moves from its natural bend (out to the side, toward the
 * pole) onto the forearm-on-line solution. With only ~5° of bend the on-line constraint would push the elbow straight
 * back, so the top bend would show in the side view only; a soft elbow at the top shows from the front too.
 */
const TOP_BEND_FRACTION = 0.15;
const topBendWeight = (prog: number) => {
  const x = Math.min(1, Math.max(0, prog / TOP_BEND_FRACTION));
  return 1 - x * x * (3 - 2 * x);
};

/**
 * Elbow for a shoulder and wrist with the forearm held on the cable line: seen from the side, the forearm points up
 * along `dir`, tilted `offLineDeg` forward of it (+ = elbow dropping behind the line). The elbow lies on a circle around
 * the shoulder–wrist axis; the point is picked to keep the forearm on the line from the side and upright from the front
 * (see the cost below).
 */
function solveElbowOnLine(shoulder: Vec3, wrist: Vec3, dir: Vec3, offLineDeg: number, pole: Vec3, frontFreeDeg: number): { elbow: Vec3; wrist: Vec3 } {
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
  const elbowAt = (psi: number) => add(c, add(scale(e1, r * Math.cos(psi)), scale(e2, r * Math.sin(psi))));
  // Side-view angle of the forearm (elbow → wrist) from the cable, minus the wanted break; wrapped to ±180°.
  const target = Math.atan2(dir.z, dir.y) + rad(offLineDeg);
  const residual = (psi: number) => {
    const f = sub(w, elbowAt(psi));
    const e = Math.atan2(f.z, f.y) - target;
    return Math.atan2(Math.sin(e), Math.cos(e));
  };
  // Seen from the front the cable runs straight up from the bar, so the forearm should too.
  const frontTilt = (psi: number) => {
    const f = sub(w, elbowAt(psi));
    return Math.abs(Math.atan2(f.x, f.y));
  };
  // Exact on the line from the side while the forearm stays within frontFreeDeg of upright from the front; past
  // that (close grips: the hands are nearly in line with the shoulders, so the elbow can only stay on the line by swinging
  // out level with the hands) the forearm trades side-view error against front tilt. One smooth cost, so the elbow
  // never jumps between solutions mid-rep.
  const free = rad(frontFreeDeg);
  const cost = (psi: number) => {
    const ft = frontTilt(psi);
    return residual(psi) ** 2 + 4 * Math.max(0, ft - free) ** 2 + 1e-3 * ft * ft;
  };
  const N = 180;
  let bestPsi = 0;
  let bestCost = Infinity;
  for (let i = 0; i < N; i++) {
    const psi = -Math.PI + (2 * Math.PI * i) / N;
    const c = cost(psi);
    if (c < bestCost) {
      bestCost = c;
      bestPsi = psi;
    }
  }
  let step = Math.PI / N;
  for (let k = 0; k < 40; k++) {
    for (const cand of [bestPsi - step, bestPsi + step]) {
      const c = cost(cand);
      if (c < bestCost) {
        bestCost = c;
        bestPsi = cand;
      }
    }
    step /= 1.6;
  }
  return { elbow: elbowAt(bestPsi), wrist: w };
}

/**
 * Mixes two elbow solutions for the same shoulder and wrist (weight 1 = `a`), keeping the result on the elbow circle so
 * segment lengths stay exact.
 */
function blendElbow(shoulder: Vec3, a: { elbow: Vec3; wrist: Vec3 }, b: { elbow: Vec3; wrist: Vec3 }, wA: number): { elbow: Vec3; wrist: Vec3 } {
  if (wA <= 0) return b;
  if (wA >= 1) return a;
  const u = unit(sub(a.wrist, shoulder));
  const mid = add(scale(a.elbow, wA), scale(b.elbow, 1 - wA));
  const c = add(shoulder, scale(u, dot(sub(a.elbow, shoulder), u)));
  const r = norm(sub(a.elbow, c));
  const dirOut = rejectFrom(sub(mid, c), u);
  if (norm(dirOut) < 1e-9) return b;
  return { elbow: add(c, scale(unit(dirOut), r)), wrist: a.wrist };
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
  let memoT = NaN;
  let memoPose: Body | undefined;
  const poseAtT = (t: number) => {
    if (t !== memoT || !memoPose) {
      memoT = t;
      memoPose = poseWithBar(1, p, top, t, breakDeg);
    }
    return memoPose;
  };
  const behindAt = (t: number) => humerusBehindDeg(poseAtT(t), endLean) - p.bottomHumerusBehindDeg;
  // Forearm held on the cable: the pull also ends where the arm can't keep it there any more (Tony, 2026-10-09: close
  // grips stop short of the chest rather than break the forearm off the cable).
  const offCable = (t: number) => {
    if (!p.forearmOnLine) return 0;
    const pose = poseAtT(t);
    const f = sub(pose.left_wrist, pose.left_elbow);
    const c = sub(pulleyOf(p), barOnLine(p, t));
    const e = Math.atan2(f.z, f.y) - Math.atan2(c.z, c.y) - rad(breakDeg);
    return (Math.abs(Math.atan2(Math.sin(e), Math.cos(e))) * 180) / Math.PI;
  };
  // Near the top the arm is almost straight and can't line up yet; the cable rule applies once the forearm is on it.
  let onCable = false;
  const stopsAt = (t: number) => behindAt(t) >= 0 || (onCable && offCable(t) > OFF_CABLE_STOP_DEG);
  let bestT = top;
  let best = behindAt(top);
  for (let t = top - 0.005; t >= -0.7; t -= 0.005) {
    if (!onCable && offCable(t) <= OFF_CABLE_STOP_DEG) onCable = true;
    if (stopsAt(t)) {
      let lo = t;
      let hi = t + 0.005;
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        if (stopsAt(m)) lo = m;
        else hi = m;
      }
      return (lo + hi) / 2;
    }
    const err = behindAt(t);
    if (err > best) {
      best = err;
      bestT = t;
    }
  }
  return bestT;
}
/** With the forearm held on the cable, how far (side view, past the planned break) it may leave it before the pull ends. */
const OFF_CABLE_STOP_DEG = 8;
/**
 * Where the bar starts and finishes on the pull line (`t`, see barOnLine). Top: shoulder-to-wrist distance gives
 * `topElbowFlexionDeg` (bisection). Bottom: the trunk-line stop point (stopOnLine), with the forearm break chosen so the
 * arms finish at `bottomArmElevationDeg`.
 */
export function barTravelFor(p: PulldownProfile): BarTravel {
  // Timing, noise and the rep count don't move the bar's end points, so variants differing only there share an entry.
  const key = JSON.stringify({ ...p, reps: 0, leadS: 0, concentricS: 0, bottomPauseS: 0, eccentricS: 0, topPauseS: 0, yank: 0, noiseM: 0, seed: 0 });
  const cached = barCache.get(key);
  if (cached) return cached;
  if (barCache.size >= BAR_CACHE_MAX) barCache.clear();
  const leftShoulder = shoulderAt(p, 0, p.trunkLeanDeg, 1);
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
    // Free elbows (close grips): "breakDeg" carries the elbow flare at the bottom instead (0 = elbows where
    // elbowsForward puts them, 1 = swung fully out to the sides), solved so the arms finish at bottomArmElevationDeg.
    // Below the natural finish (flare 0) the slider can't go lower, so flare stays 0.
    const flareElevation = (f: number) => armElevationDeg(poseWithBar(1, p, top, bottomFor(f), f), endLean);
    let flare = 0;
    if (flareElevation(0) < p.bottomArmElevationDeg) {
      let flo = 0;
      let fhi = 1;
      for (let i = 0; i < 25; i++) {
        const m = (flo + fhi) / 2;
        if (flareElevation(m) < p.bottomArmElevationDeg) flo = m;
        else fhi = m;
      }
      flare = (flo + fhi) / 2;
    }
    const travel = { top, bottom: bottomFor(flare), breakDeg: flare };
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
  const neckBase = shoulderMidAt(lean); // head does not move with the shoulder girdle

  // The bar runs down the pull line (fixed in the room, pullLineDeg off vertical) from top to bottom.
  const t = topT + (bottomT - topT) * prog;
  // Forearms line up with the force, i.e. the cable from the bar to the pulley above the knees.
  const pulley = pulleyOf(p);
  const dir = unit(sub(pulley, barOnLine(p, t)));
  const offLine = p.forearmOnLine ? forearmOffLineAt(prog, breakDeg, p.forearmBreakFraction) : 0;

  const pose = {} as Body;
  for (const [side, s] of [["left", 1], ["right", -1]] as const) {
    const shoulder = shoulderAt(p, prog, lean, s);
    const lag = side === "right" ? p.rightHandLagM * prog : 0;
    const wristTarget = add(barOnLine(p, t + lag), v(s * gripHalfWidth(p), 0, 0));
    // Elbows bend toward the pole: out, down and slightly back by default; forward as elbowsForward → 1.
    // Free elbows: flare out toward the sides over the last part of the pull (see barTravelFor).
    const k = p.forearmOnLine ? p.elbowsForward : p.elbowsForward * (1 - forearmOffLineAt(prog, breakDeg, p.forearmBreakFraction));
    const pole = add(add(scale(L, s * (1 - k)), scale(U, -1)), scale(F, -0.3 + 1.3 * k));
    const free = solveElbow(shoulder, wristTarget, pole);
    const onLine = p.forearmOnLine ? solveElbowOnLine(shoulder, wristTarget, dir, offLine, pole, p.forearmFrontTiltFreeDeg) : free;
    const { elbow, wrist } = blendElbow(shoulder, free, onLine, p.forearmOnLine ? topBendWeight(prog) : 1);
    const forearmDir = unit(sub(wrist, elbow));
    // Thumbs point toward the midline overhand, away from it underhand, and back toward the face on a neutral grip.
    const thumbSide = p.gripType === "underhand" ? scale(L, s) : p.gripType === "neutral" ? scale(F, -1) : scale(L, -s);
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

/** Seated: hip midpoint height above the floor. */
export const PULLDOWN_HIP_HEIGHT_M = 0.5;
/** Protocol lens height for the pulldown: seated shoulder height (Tony, 2026-10-09). */
export const PULLDOWN_CAMERA_HEIGHT_M = PULLDOWN_HIP_HEIGHT_M + BODY.trunk;
/** The synthetic lifter's standing height, for the protocol camera distance. */
export const PULLDOWN_STATURE_M = SYNTH_STATURE_M;

/** The protocol camera for the synthetic pulldown, optionally moved to another azimuth. */
export function pulldownCamera(azimuthDeg?: number): CameraPlacement {
  return standardExerciseCamera(PULLDOWN_CAMERA_HEIGHT_M, PULLDOWN_STATURE_M, azimuthDeg);
}

/** Builds a PoseSequence (33 image + 33 world landmarks per frame) for a synthetic pulldown set. */
export function synthesizePulldown(
  profile: PulldownProfile,
  options: { camera?: CameraPlacement; id?: string } = {},
): PoseSequence {
  const camera = options.camera ?? pulldownCamera();
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
