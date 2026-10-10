// Synthetic lat pulldown clips: a 3D stick figure posed in MediaPipe's 33-landmark layout.
// These exist to exercise the math and to try out parameter values. They are NOT recordings and NOT a clinical
// reference: every body dimension and motion value below is a made-up default chosen to look like a plausible rep.
import { POSE_LANDMARK_NAMES, type PoseLandmarkName, type PoseSequence } from "@optimass/types";
import { standardExerciseCamera, type CameraPlacement } from "../camera";
import type { Skeleton } from "../body/skeleton";
import { SYNTH_STATURE_M } from "../posture/synth";
import { renderSequence, type Body } from "../synth-render";
import { add, cross, dist, norm, rejectFrom, scale, sub, unit, v, type Vec3 } from "../vec3";

export type PulldownGripType = "overhand" | "underhand" | "neutral";
export type PulldownAttachment = "straight_bar" | "neutral_bar";

/**
 * Where in the pull each joint keyframe sits: share of the way from the top (0, arms overhead) to the bottom (1).
 * Between keyframes each joint follows a smooth curve that never overshoots (monotone cubic).
 */
export const PULLDOWN_KEY_AT = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1] as const;

/**
 * The joint angles that make the movement, one value per keyframe (PULLDOWN_KEY_AT). Joint by joint, per variation
 * (Tony, 2026-10-10). The bar's path, the line of pull and the forearm's angle to the cable are results of these, not
 * inputs. Angles in degrees, distances in meters.
 */
export interface PulldownJoints {
  /** Trunk lean back from vertical. */
  trunkLeanDeg: number[];
  /** Shoulder girdle elevation along the trunk (+ = toward the ears, − = depressed). */
  shoulderElevationM: number[];
  /** Scapular retraction: each shoulder joint glides back around the ribcage and toward the spine. */
  scapularRetractionM: number[];
  /** Scapular downward rotation. MediaPipe has no scapula points, so it only shows as extra shoulder depression. */
  scapularDownwardRotationDeg: number[];
  /** Elbow flexion (0 = straight arm). */
  elbowFlexionDeg: number[];
  /**
   * Where the hand is, seen from the side: angle of the shoulder-to-hand line from the trunk line (0 = straight
   * overhead along the trunk, 90 = straight ahead of the shoulder, past 90 = below shoulder level).
   */
  armAngleDeg: number[];
  /**
   * Shoulder rotation, read from which way the elbow points around the shoulder-to-hand line (hands fixed on the bar,
   * so this swing is humeral rotation; Tony, 2026-10-10): 0 = straight out to the side (more internal rotation),
   * +90 = in front of that line (forward when the arms are overhead, under it once the hands are in front; more
   * external), −90 = the other way.
   */
  elbowDirectionDeg: number[];
}
export type PulldownJointName = keyof PulldownJoints;
export const PULLDOWN_JOINT_NAMES = [
  "trunkLeanDeg",
  "shoulderElevationM",
  "scapularRetractionM",
  "scapularDownwardRotationDeg",
  "elbowFlexionDeg",
  "armAngleDeg",
  "elbowDirectionDeg",
] as const satisfies readonly PulldownJointName[];

/** Joint-centre distances of the simulated lifter (m). Arms per side, so a left-right difference carries through. */
export interface PulldownBody {
  /** Hip midpoint to shoulder midpoint. */
  trunk: number;
  shoulderHalfWidth: number;
  hipHalfWidth: number;
  upperArm: { left: number; right: number };
  forearm: { left: number; right: number };
  thigh: number;
  shin: number;
}

/** How one synthetic set moves. Times are seconds, distances meters, angles degrees. */
export interface PulldownProfile {
  reps: number;
  /** Still time at the top before the first rep. */
  leadS: number;
  concentricS: number;
  bottomPauseS: number;
  eccentricS: number;
  topPauseS: number;
  /** Pulley (where the cable leaves the machine): height above the hips and distance ahead of the knees (m). Used to
   *  draw the cable and to judge the forearm against it. One position for every variation (Tony, 2026-10-10). */
  pulleyAboveHipM: number;
  pulleyAheadOfKneeM: number;
  /**
   * Hand spacing on the bar as a multiple of shoulder width (wrist to wrist ÷ shoulder to shoulder). The hands stay on
   * the bar at this spacing whatever the joints do.
   */
  gripWidthXShoulder: number;
  /** Joint keyframes (see PulldownJoints). */
  joints: PulldownJoints;
  /** Hand orientation: overhand (palms forward), underhand (palms toward the face) or neutral (palms facing each other). */
  gripType: PulldownGripType;
  /** What the hands hold. Only changes the hand landmarks and how Motion Lab draws it; spacing is gripWidthXShoulder. */
  attachment: PulldownAttachment;
  /** Head (ears) drifts this far forward of the shoulders, perpendicular to the trunk, as the bar comes down. */
  headForwardM: number;
  /** Right arm runs this share of the pull behind the left (an uneven pull; 0 = even). */
  rightArmLag: number;
  /**
   * Yanking the bar down: 0 = smooth start from the top, 1 = the bar is snapped down from a standstill (most of the
   * speed arrives in the first frames of the pull instead of building up).
   */
  yank: number;
  /** The lifter's bone lengths (pulldownBodyFromSkeleton); the default synthetic lifter when absent. */
  body?: PulldownBody;
  /** Std. dev. of per-landmark jitter added to world coordinates, mimicking estimation noise. */
  noiseM: number;
  seed: number;
}

/**
 * Tony's wide overhand baseline. The joint keyframes were read off the earlier bar-driven model at Tony's Motion Lab
 * settings (2026-10-09: grip 2.2x, 11° elbow bend at the top, trunk 8° back with 18° swing, line of pull to the pulley,
 * forearms on the cable with a ~1° break, elbows 5° behind the trunk line, arms 42° from the trunk at the bottom), so the
 * motion is the same within about a centimetre. Scapular values are PLACEHOLDERS.
 */
export const GOOD_PULLDOWN: PulldownProfile = {
  reps: 3,
  leadS: 0.6,
  concentricS: 1.0,
  bottomPauseS: 0.25,
  eccentricS: 2.0,
  topPauseS: 0.25,
  pulleyAboveHipM: 1.53,
  pulleyAheadOfKneeM: -0.22,
  gripWidthXShoulder: 2.2,
  joints: {
    trunkLeanDeg: [8, 9.8, 12.5, 17, 21.5, 24.2, 26],
    shoulderElevationM: [0.03, 0.025, 0.017, 0.005, -0.008, -0.015, -0.02],
    scapularRetractionM: [0, 0.002, 0.004, 0.007, 0.011, 0.013, 0.015],
    scapularDownwardRotationDeg: [0, 2, 5, 10, 15, 18, 20],
    elbowFlexionDeg: [11, 44.1, 67.8, 93.4, 109.9, 116, 118.4],
    armAngleDeg: [25.4, 29.1, 35.3, 47.9, 66.5, 83.7, 99],
    elbowDirectionDeg: [37.9, 19.7, 14.7, 21.8, 36.5, 52.1, 67.3],
  },
  gripType: "overhand",
  attachment: "straight_bar",
  headForwardM: 0,
  rightArmLag: 0,
  yank: 0,
  noiseM: 0.004,
  seed: 1,
};

/** A fault: plain settings it changes, plus how much it adds to each joint keyframe (on top of any variation). */
export interface PulldownFault {
  set?: Partial<Omit<PulldownProfile, "joints">>;
  add?: Partial<PulldownJoints>;
}

/**
 * One fault per common error, each changing only what that fault changes. Joint changes were read off the earlier
 * bar-driven model on the wide grip; they add to whichever variation the fault is performed on.
 */
export const PULLDOWN_FAULTS = {
  good: {},
  /** Torso swings back hard to start the bar moving. */
  momentum_swing: {
    set: { concentricS: 0.6, seed: 2 },
    add: {
      trunkLeanDeg: [2, 3, 4.5, 7, 9.5, 11, 12],
      elbowFlexionDeg: [0, -2.9, -5.2, -8.6, -10.8, -11, -10.4],
      armAngleDeg: [2.9, 4.8, 7.4, 11.2, 12.1, 8.8, 3.8],
      elbowDirectionDeg: [0.8, 2.7, 4.9, 6.9, 5.7, 0.6, -5.8],
    },
  },
  /** Elbows never straighten at the top and the bar stops around the chin. */
  partial_rom: {
    set: { seed: 3 },
    add: {
      elbowFlexionDeg: [29, 8.9, -0.3, -8.3, -12, -12.2, -11.3],
      armAngleDeg: [0.3, 0.3, -0.1, -1.8, -7.7, -16, -24.5],
      elbowDirectionDeg: [-0.3, -1.2, 0, -0.8, -7.1, -16.6, -26.7],
    },
  },
  /** Shoulders ride up toward the ears instead of depressing as the bar comes down. */
  shrug: {
    set: { seed: 4 },
    add: {
      shoulderElevationM: [0, 0.007, 0.018, 0.035, 0.053, 0.063, 0.07],
      scapularDownwardRotationDeg: [0, -2, -5, -10, -15, -18, -20],
      elbowFlexionDeg: [0, 1, 1.4, 0.4, -2.4, -4.9, -6.8],
      armAngleDeg: [0, 0.6, 1.8, 5.4, 11.2, 13.4, 12.2],
      elbowDirectionDeg: [0, 0.9, 2.8, 7.4, 15.7, 8.1, 2.1],
    },
  },
  /** Pulls past the trunk line: the whole arm rotates back around the shoulder at the bottom. */
  over_pull: {
    set: { seed: 9 },
    add: {
      elbowFlexionDeg: [0, 5, 8.1, 10.6, 9.3, 5.7, 1.9],
      armAngleDeg: [0, 0.2, 0.6, 3.6, 16.6, 35.3, 46.1],
      elbowDirectionDeg: [0, -0.7, -0.4, 2.7, 17.7, 27.5, 28.8],
    },
  },
  /** Bar is let go on the way up instead of being lowered under control. */
  fast_eccentric: { set: { eccentricS: 0.5, seed: 5 } },
  /** Closer grip with the elbows travelling in front of the body: more shoulder extension, less adduction. */
  elbows_forward: {
    set: { gripWidthXShoulder: 1.1, seed: 8 },
    add: {
      elbowFlexionDeg: [0, 7.6, 13.3, 21.7, 30.5, 34.6, 35],
      armAngleDeg: [-0.3, -0.4, -0.6, 0, 4, 11.9, 20.2],
      elbowDirectionDeg: [51, 69.2, 74.1, 67, 54.1, 10, -17.1],
    },
  },
  /** Chin pokes forward as the bar comes down. */
  forward_head: { set: { headForwardM: 0.06, seed: 7 } },
  /** Right arm finishes short of the left. */
  asymmetric: { set: { rightArmLag: 0.12, seed: 6 } },
  /** Bar is yanked down from the top instead of the pull building speed smoothly. */
  yank: { set: { yank: 1, seed: 10 } },
} satisfies Record<string, PulldownFault>;
export type PulldownVariant = keyof typeof PULLDOWN_FAULTS;

/** A profile with a fault performed on it. */
export function withFault(base: PulldownProfile, fault: PulldownFault): PulldownProfile {
  const joints = { ...base.joints };
  for (const [name, delta] of Object.entries(fault.add ?? {}) as [PulldownJointName, number[]][]) {
    joints[name] = base.joints[name].map((x, i) => x + (delta[i] ?? 0));
  }
  return { ...base, ...fault.set, joints };
}

/** Each fault performed on Tony's wide overhand baseline. */
export const PULLDOWN_VARIANTS = Object.fromEntries(
  Object.entries(PULLDOWN_FAULTS).map(([name, fault]) => [name, withFault(GOOD_PULLDOWN, fault)]),
) as Record<PulldownVariant, PulldownProfile>;

/**
 * Pulldown variations (grip and attachment). wide_overhand is Tony's baseline; the others are PLACEHOLDER starting
 * points for Tony to tune in Motion Lab and paste back. Shared across variations: pulley and tempo. Tony dropped the
 * V-handle (2026-10-09).
 */
export const PULLDOWN_SETUPS = {
  wide_overhand: GOOD_PULLDOWN,
  // Tony's Motion Lab settings (2026-10-10), read off the earlier model: forearms on the cable from the side and
  // straight down from the front (elbows bend forward), bar finishing around chin to nose height, trunk 6° back with
  // 7° swing, 1 s up / 2 s down, 0.2 s pauses. Grip and top elbow bend came from Tony's underhand clip.
  narrow_underhand: {
    ...GOOD_PULLDOWN,
    gripType: "underhand",
    gripWidthXShoulder: 1.1,
    bottomPauseS: 0.2,
    topPauseS: 0.2,
    joints: {
      ...GOOD_PULLDOWN.joints,
      trunkLeanDeg: [6, 6.7, 7.8, 9.5, 11.2, 12.3, 13],
      elbowFlexionDeg: [18, 36.7, 53.2, 71.8, 84.8, 90.7, 94],
      armAngleDeg: [34.4, 37.2, 41.8, 50.2, 59.9, 66.4, 70.9],
      elbowDirectionDeg: [89.4, 85.9, 85.7, 86.2, 86.3, 86.3, 86.3],
    },
  },
  // Forearms on the cable; the bar stops around the collarbone where the forearm would leave it.
  neutral_bar: {
    ...GOOD_PULLDOWN,
    gripType: "neutral",
    attachment: "neutral_bar",
    gripWidthXShoulder: 1.5,
    joints: {
      ...GOOD_PULLDOWN.joints,
      elbowFlexionDeg: [11, 43.7, 67.1, 91.7, 106.8, 112, 113.8],
      armAngleDeg: [31.5, 36.4, 44.4, 60.2, 80.4, 94.7, 104.9],
      elbowDirectionDeg: [48.9, 56.4, 47.3, 57.3, 67.6, 92.6, 92.8],
    },
  },
} satisfies Record<string, PulldownProfile>;
export type PulldownSetup = keyof typeof PULLDOWN_SETUPS;

/** A fault performed on a variation: the variation's profile plus whatever the fault changes. */
export function pulldownProfileFor(setup: PulldownSetup, variant: PulldownVariant = "good"): PulldownProfile {
  return withFault(PULLDOWN_SETUPS[setup], PULLDOWN_FAULTS[variant]);
}

/** Made-up anthropometrics for a ~1.75 m lifter, meters. */
const BODY: PulldownBody = {
  trunk: 0.5,
  shoulderHalfWidth: 0.2,
  hipHalfWidth: 0.1,
  upperArm: { left: 0.3, right: 0.3 },
  forearm: { left: 0.27, right: 0.27 },
  thigh: 0.43,
  shin: 0.43,
};
/** The default synthetic lifter's body (used when a profile has no `body`). */
export const PULLDOWN_SYNTH_BODY: Readonly<PulldownBody> = BODY;

/**
 * The lifter's body from the posture check (Tony, 2026-10-10): bone lengths and proportions measured standing, so the
 * simulation moves this person's skeleton. Pass a skeleton calibrated with the user's height to get real meters.
 * Trunk and shoulder width come from the standing posture; the girdle still moves during the lift.
 */
export function pulldownBodyFromSkeleton(sk: Skeleton): PulldownBody {
  const len = (k: keyof Skeleton["segments"]) => sk.segments[k].lengthM;
  const shoulderHalfWidth = len("shoulder_width") / 2;
  const hipHalfWidth = len("hip_width") / 2;
  // Side trunk lines run shoulder to hip on each side; the model's trunk is hip midpoint to shoulder midpoint.
  const side = (len("left_trunk") + len("right_trunk")) / 2;
  const trunk = Math.sqrt(Math.max(0, side * side - (shoulderHalfWidth - hipHalfWidth) ** 2));
  return {
    trunk,
    shoulderHalfWidth,
    hipHalfWidth,
    upperArm: { left: len("left_upper_arm"), right: len("right_upper_arm") },
    forearm: { left: len("left_forearm"), right: len("right_forearm") },
    thigh: (len("left_thigh") + len("right_thigh")) / 2,
    shin: (len("left_shin") + len("right_shin")) / 2,
  };
}
const bodyOf = (p: PulldownProfile): PulldownBody => p.body ?? BODY;
/** The synthetic lifter's arm dimensions, for the grip formula (grip.ts). */
export const PULLDOWN_SYNTH_ARMS = { shoulderWidthM: 2 * BODY.shoulderHalfWidth, upperArmM: BODY.upperArm.left, forearmM: BODY.forearm.left };

const FPS = 30;

const rad = (d: number) => (d * Math.PI) / 180;
const ease = (p: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, p)))) / 2;

/** Rep progress at time t: 0 = top (arms overhead), 1 = bottom. Joint keyframes are placed on this scale. */
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

/** Monotone cubic (PCHIP) through the keyframes: smooth, and never overshoots between two keyframe values. */
function keyCurve(ys: readonly number[], x: number): number {
  const xs = PULLDOWN_KEY_AT;
  const n = xs.length;
  if (x <= xs[0]) return ys[0]!;
  if (x >= xs[n - 1]!) return ys[n - 1]!;
  const h = (i: number) => xs[i + 1]! - xs[i]!;
  const d = (i: number) => (ys[i + 1]! - ys[i]!) / h(i);
  const slope = (i: number) => {
    if (i === 0) return d(0);
    if (i === n - 1) return d(n - 2);
    if (d(i - 1) * d(i) <= 0) return 0;
    const w1 = 2 * h(i) + h(i - 1);
    const w2 = h(i) + 2 * h(i - 1);
    return (w1 + w2) / (w1 / d(i - 1) + w2 / d(i));
  };
  let i = 0;
  while (x > xs[i + 1]!) i++;
  const t = (x - xs[i]!) / h(i);
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * ys[i]! +
    (t3 - 2 * t2 + t) * h(i) * slope(i) +
    (-2 * t3 + 3 * t2) * ys[i + 1]! +
    (t3 - t2) * h(i) * slope(i + 1)
  );
}

/** Every joint's value at rep progress `prog`. */
export function jointsAt(p: PulldownProfile, prog: number): Record<PulldownJointName, number> {
  return Object.fromEntries(PULLDOWN_JOINT_NAMES.map((n) => [n, keyCurve(p.joints[n], prog)])) as Record<PulldownJointName, number>;
}

// Body frame: x = toward the lifter's left, y = up, z = forward (the way the lifter faces). Origin at the hip midpoint.
// The lifter sits with thighs horizontal under the knee pad.

const gripHalfWidth = (p: PulldownProfile) => p.gripWidthXShoulder * bodyOf(p).shoulderHalfWidth;

function shoulderMidAt(leanDeg: number, body: PulldownBody): Vec3 {
  return v(0, body.trunk * Math.cos(rad(leanDeg)), -body.trunk * Math.sin(rad(leanDeg)));
}

/** Shoulder joint to the scapula's rotation centre, sideways (m). Made-up anatomy for the synthetic lifter. */
const SCAPULA_ROTATION_RADIUS = 0.1;

/**
 * Shoulder joint (glenohumeral centre) for side `s` (1 = left, −1 = right): trunk position plus shoulder girdle
 * elevation/depression, retraction and downward rotation.
 */
function shoulderAt(j: Record<PulldownJointName, number>, s: 1 | -1, body: PulldownBody): Vec3 {
  const L = v(1, 0, 0);
  const trunkAxis = unit(shoulderMidAt(j.trunkLeanDeg, body));
  const trunkFwd = unit(cross(L, trunkAxis));
  const retraction = j.scapularRetractionM;
  const rot = rad(j.scapularDownwardRotationDeg);
  const out = body.shoulderHalfWidth - 0.4 * retraction - SCAPULA_ROTATION_RADIUS * (1 - Math.cos(rot));
  const up = j.shoulderElevationM - SCAPULA_ROTATION_RADIUS * Math.sin(rot);
  return add(add(add(shoulderMidAt(j.trunkLeanDeg, body), scale(trunkAxis, up)), scale(trunkFwd, -retraction)), scale(L, s * out));
}

/** Shoulder-to-wrist distance for an elbow flexion angle (0 = straight arm). */
function reachForFlexion(flexionDeg: number, a: number, b: number): number {
  return Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(rad(flexionDeg)));
}

/**
 * One arm from its joint angles: the hand sits on the bar (gripHalfWidth out from the midline) at the shoulder-to-hand
 * distance the elbow flexion gives, at armAngleDeg from the trunk line seen from the side; the elbow points
 * elbowDirectionDeg around the shoulder-to-hand line.
 */
function armAt(shoulder: Vec3, j: Record<PulldownJointName, number>, gripHalf: number, s: 1 | -1, body: PulldownBody): { elbow: Vec3; wrist: Vec3 } {
  const L = v(1, 0, 0);
  const U = unit(shoulderMidAt(j.trunkLeanDeg, body));
  const F = cross(L, U);
  const a = s === 1 ? body.upperArm.left : body.upperArm.right;
  const b = s === 1 ? body.forearm.left : body.forearm.right;
  const reach = reachForFlexion(j.elbowFlexionDeg, a, b);
  const dx = s * gripHalf - shoulder.x;
  // Too close a grip for the reach: the hand lands as near to the bar as the arm allows.
  const r = Math.sqrt(Math.max(0, reach * reach - dx * dx));
  const ang = rad(j.armAngleDeg);
  const wrist = add(add(shoulder, scale(L, dx)), add(scale(U, r * Math.cos(ang)), scale(F, r * Math.sin(ang))));
  const sw = sub(wrist, shoulder);
  const d = Math.min(norm(sw), (a + b) * 0.999);
  const u = unit(sw);
  const x = (a * a - b * b + d * d) / (2 * d);
  const re = Math.sqrt(Math.max(0, a * a - x * x));
  const e1 = unit(rejectFrom(scale(L, s), u)); // out to the side
  const e2 = scale(cross(e1, u), s); // forward when the arm is overhead, down when the hand is in front
  const phi = rad(j.elbowDirectionDeg);
  const elbow = add(add(shoulder, scale(u, x)), add(scale(e1, re * Math.cos(phi)), scale(e2, re * Math.sin(phi))));
  return { elbow, wrist };
}

/** Full 33-point pose in the body frame for rep progress `prog`. */
export function poseAt(prog: number, p: PulldownProfile): Body {
  const L = v(1, 0, 0);
  const U = v(0, 1, 0);
  const F = v(0, 0, 1);
  const body = bodyOf(p);
  const j = jointsAt(p, prog);
  const trunkAxis = unit(shoulderMidAt(j.trunkLeanDeg, body));
  const neckBase = shoulderMidAt(j.trunkLeanDeg, body); // head does not move with the shoulder girdle

  const pose = {} as Body;
  for (const [side, s] of [["left", 1], ["right", -1]] as const) {
    const js = side === "right" && p.rightArmLag ? jointsAt(p, prog * (1 - p.rightArmLag)) : j;
    // The trunk is shared: only the arm and girdle lag.
    const jArm = { ...js, trunkLeanDeg: j.trunkLeanDeg };
    const shoulder = shoulderAt(jArm, s, body);
    const { elbow, wrist } = armAt(shoulder, jArm, gripHalfWidth(p), s, body);
    const forearmDir = unit(sub(wrist, elbow));
    // Thumbs point toward the midline overhand, away from it underhand, and back toward the face on a neutral grip.
    const thumbSide = p.gripType === "underhand" ? scale(L, s) : p.gripType === "neutral" ? scale(F, -1) : scale(L, -s);
    pose[`${side}_shoulder`] = shoulder;
    pose[`${side}_elbow`] = elbow;
    pose[`${side}_wrist`] = wrist;
    pose[`${side}_index`] = add(wrist, scale(forearmDir, 0.09));
    pose[`${side}_pinky`] = add(add(wrist, scale(forearmDir, 0.08)), scale(thumbSide, -0.03));
    pose[`${side}_thumb`] = add(add(wrist, scale(forearmDir, 0.05)), scale(thumbSide, 0.03));

    const hip = scale(L, s * body.hipHalfWidth);
    const knee = add(hip, scale(F, body.thigh));
    const ankle = add(add(knee, scale(U, -body.shin)), scale(F, 0.05));
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

/**
 * The protocol camera for the synthetic pulldown, optionally moved to another azimuth. With a body, the lens sits at
 * that lifter's seated shoulder height.
 */
export function pulldownCamera(azimuthDeg?: number, body?: PulldownBody): CameraPlacement {
  const lens = body ? PULLDOWN_HIP_HEIGHT_M + body.trunk : PULLDOWN_CAMERA_HEIGHT_M;
  return standardExerciseCamera(lens, PULLDOWN_STATURE_M, azimuthDeg);
}

/** Builds a PoseSequence (33 image + 33 world landmarks per frame) for a synthetic pulldown set. */
export function synthesizePulldown(
  profile: PulldownProfile,
  options: { camera?: CameraPlacement; id?: string } = {},
): PoseSequence {
  const camera = options.camera ?? pulldownCamera(undefined, profile.body);
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

/** The pulley in the body frame: pulleyAboveHipM over the hips, pulleyAheadOfKneeM ahead of the knees. */
export const pulleyOf = (p: PulldownProfile): Vec3 => v(0, p.pulleyAboveHipM, bodyOf(p).thigh + p.pulleyAheadOfKneeM);

/** The bar's line of pull from the top to the bottom of the rep, tilt from vertical (degrees, + = top end forward). */
export function pullLineDegOf(p: PulldownProfile): number {
  const top = poseAt(0, p).left_wrist;
  const bottom = poseAt(1, p).left_wrist;
  return (Math.atan2(top.z - bottom.z, top.y - bottom.y) * 180) / Math.PI;
}
