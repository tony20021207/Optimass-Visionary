// Synthetic lat pulldown clips: a 3D stick figure posed in MediaPipe's 33-landmark layout.
// These exist to exercise the math and to try out parameter values. They are NOT recordings and NOT a clinical
// reference: every body dimension and motion value below is a made-up default chosen to look like a plausible rep.
import { POSE_LANDMARK_NAMES, type PoseLandmarkName, type PoseSequence } from "@optimass/types";
import { standardExerciseCamera, type CameraPlacement } from "../camera";
import type { Skeleton } from "../body/skeleton";
import { SYNTH_STATURE_M } from "../posture/synth";
import { renderSequence, type Body } from "../synth-render";
import type { JointMotionId } from "../joints/catalogue";
import { add, cross, dist, dot, scale, sub, unit, v, type Vec3 } from "../vec3";

export type PulldownGripType = "overhand" | "underhand" | "neutral";
export type PulldownAttachment = "straight_bar" | "neutral_bar";

/**
 * Where in the pull each joint keyframe sits, as bar progress (0 = top, arms overhead; 1 = bottom). Between keyframes
 * each joint follows a smooth curve that never overshoots (monotone cubic).
 *
 * Phases (Tony, 2026-10-10): the pulldown is mostly one joint action (shoulder adduction and extension, the elbow a
 * synergist), so three phases of equal duration; complex lifts such as the deadlift get their own break points.
 * PULLDOWN_PHASES gives the break points as shares of the pull's duration, in the same shape as the `phases` list in
 * content/rules/coaching/lat_pulldown.yaml (Tier 2, PR #3), which should become the one source once both are merged.
 * The keyframes sit at those times on a smooth pull: time thirds of the eased pull are 0.25 and 0.75 of the bar's travel.
 */
export const PULLDOWN_PHASES = [
  { id: "top", label: "Top third", endsAt: 1 / 3 },
  { id: "middle", label: "Middle third", endsAt: 2 / 3 },
  { id: "bottom", label: "Bottom third", endsAt: 1 },
] as const;
/** Bar progress at a share of the pull's duration, on a smooth (not yanked) pull: see barProgressAt. */
const progressAtTimeShare = (share: number) => (1 - Math.cos(Math.PI * share)) / 2;
export const PULLDOWN_KEY_AT: readonly number[] = [0, ...PULLDOWN_PHASES.map((ph) => progressAtTimeShare(ph.endsAt))];

/**
 * The pulldown's joint keyframes, in the shared clinical vocabulary (joints/catalogue.ts; Tony, 2026-10-10): one value
 * per keyframe (PULLDOWN_KEY_AT). Signs follow the catalogue: + = flexion, elevation, protraction, upward
 * rotation. Shoulder rotation is not here: with the hands on the bar it is set by where the elbow has to sit (closed
 * chain), so it is a result (pulldownShoulderRotationDeg). Bar path, line of pull and forearm-to-cable angle are
 * results too.
 */
export const PULLDOWN_JOINT_NAMES = [
  "trunk_flexion",
  "scapular_elevation",
  "scapular_protraction",
  "scapular_upward_rotation",
  "shoulder_elevation",
  "shoulder_plane_of_elevation",
  "elbow_flexion",
] as const satisfies readonly JointMotionId[];
export type PulldownJointName = (typeof PULLDOWN_JOINT_NAMES)[number];
export type PulldownJoints = Record<PulldownJointName, number[]>;

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
 * checks read the same. With only four keyframes (time thirds) the hand path differs from that model by up to ~6 cm
 * mid-pull: the values were fitted to its arm directions and a smooth hand path. Scapular values are PLACEHOLDERS.
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
    trunk_flexion: [-8, -12.5, -21.5, -26],
    scapular_elevation: [0.03, 0.017, -0.008, -0.02],
    scapular_protraction: [0, -0.004, -0.011, -0.015],
    scapular_upward_rotation: [0, -5, -15, -20],
    shoulder_elevation: [139.8, 107.2, 65, 41.9],
    shoulder_plane_of_elevation: [41.1, 29.8, 18.3, -7.5],
    elbow_flexion: [11, 63.8, 103.8, 118.4],
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
      trunk_flexion: [-2, -4.5, -9.5, -12],
      shoulder_elevation: [-1.9, -3.5, 2.9, 4.6],
      shoulder_plane_of_elevation: [2.6, 6.1, -2.2, 7.5],
      elbow_flexion: [0, -4.1, -6.1, -10.4],
    },
  },
  /** Elbows never straighten at the top and the bar stops around the chin. */
  partial_rom: {
    set: { seed: 3 },
    add: {
      shoulder_elevation: [-14.8, -1.9, 12.5, 19.7],
      shoulder_plane_of_elevation: [-4, -0.7, -1.2, 16.6],
      elbow_flexion: [29, 2.3, -6.7, -11.3],
    },
  },
  /** Shoulders ride up toward the ears instead of depressing as the bar comes down. */
  shrug: {
    set: { seed: 4 },
    add: {
      scapular_elevation: [0, 0.018, 0.053, 0.07],
      scapular_upward_rotation: [0, 5, 15, 20],
      shoulder_elevation: [0, -3.3, -1.4, -0.6],
      shoulder_plane_of_elevation: [0, 5.7, -3.8, 0.1],
      elbow_flexion: [0, -0.8, 0.8, -6.8],
    },
  },
  /** Pulls past the trunk line: the whole arm rotates back around the shoulder at the bottom. */
  over_pull: {
    set: { seed: 9 },
    add: {
      shoulder_elevation: [0, -9, -21.3, -0.4],
      shoulder_plane_of_elevation: [0, 11.1, -8.1, -37.6],
      elbow_flexion: [0, 3, 9.2, 1.9],
    },
  },
  /** Bar is let go on the way up instead of being lowered under control. */
  fast_eccentric: { set: { eccentricS: 0.5, seed: 5 } },
  /** Closer grip with the elbows travelling in front of the body: more shoulder extension, less adduction. */
  elbows_forward: {
    set: { gripWidthXShoulder: 1.1, seed: 8 },
    add: {
      shoulder_elevation: [9.8, 0.8, -17.1, 0.1],
      shoulder_plane_of_elevation: [44.7, 57.5, 62.6, 0],
      elbow_flexion: [0, 15.5, 36.1, 35],
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
      trunk_flexion: [-6, -7.8, -11.2, -13],
      scapular_elevation: [0.03, 0.017, -0.008, -0.02],
      scapular_protraction: [0, -0.004, -0.011, -0.015],
      scapular_upward_rotation: [0, -5, -15, -20],
      shoulder_elevation: [137.1, 112.9, 80.5, 65.2],
      shoulder_plane_of_elevation: [86.9, 85.4, 84.7, 83.4],
      elbow_flexion: [18, 53.2, 84.8, 94],
    },
  },
  // Forearms on the cable; the bar stops around the collarbone where the forearm would leave it.
  neutral_bar: {
    ...GOOD_PULLDOWN,
    gripType: "neutral",
    attachment: "neutral_bar",
    gripWidthXShoulder: 1.5,
    joints: {
      trunk_flexion: [-8, -12.5, -21.5, -26],
      scapular_elevation: [0.03, 0.017, -0.008, -0.02],
      scapular_protraction: [0, -0.004, -0.011, -0.015],
      scapular_upward_rotation: [0, -5, -15, -20],
      shoulder_elevation: [142.3, 104.9, 52.6, 23.9],
      shoulder_plane_of_elevation: [67.5, 57.3, 57.3, 63.1],
      elbow_flexion: [11, 68.1, 105.1, 113.8],
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
  if (x <= xs[0]!) return ys[0]!;
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

/** Shoulder joint to the scapula's rotation centre, sideways (m). Made-up anatomy for the synthetic lifter. */
const SCAPULA_ROTATION_RADIUS = 0.1;

type JointValues = Record<PulldownJointName, number>;
/** Trunk axes for a trunk flexion angle (− = leaning back): up along the trunk, and forward square to it. */
function trunkFrame(trunkFlexionDeg: number): { U: Vec3; F: Vec3 } {
  const lean = -trunkFlexionDeg;
  const U = v(0, Math.cos(rad(lean)), -Math.sin(rad(lean)));
  return { U, F: cross(v(1, 0, 0), U) };
}

/**
 * Shoulder joint (glenohumeral centre) for side `s` (1 = left, −1 = right): trunk position plus scapular elevation,
 * protraction and upward rotation.
 */
function shoulderAt(j: JointValues, s: 1 | -1, body: PulldownBody): Vec3 {
  const L = v(1, 0, 0);
  const { U, F } = trunkFrame(j.trunk_flexion);
  const protraction = j.scapular_protraction;
  const down = rad(-j.scapular_upward_rotation);
  const out = body.shoulderHalfWidth + 0.4 * protraction - SCAPULA_ROTATION_RADIUS * (1 - Math.cos(down));
  const up = j.scapular_elevation - SCAPULA_ROTATION_RADIUS * Math.sin(down);
  return add(add(add(scale(U, body.trunk), scale(U, up)), scale(F, protraction)), scale(L, s * out));
}

/** Rodrigues rotation of `x` about unit `axis` by `a` radians. */
const rotateAbout = (x: Vec3, axis: Vec3, a: number): Vec3 =>
  add(add(scale(x, Math.cos(a)), scale(cross(axis, x), Math.sin(a))), scale(axis, dot(axis, x) * (1 - Math.cos(a))));

/**
 * One arm from clinical angles (joints/catalogue.ts): shoulder elevation (0 = arm at the side, 180 = overhead) in its
 * plane of elevation places the humerus against the trunk, external rotation turns the forearm around it, elbow flexion
 * bends it. Elevation + plane (Tony, 2026-10-10) rather than flexion + abduction angles, which can't place a horizontal
 * arm that points between forward and sideways (both read 90°).
 */
function armFromAngles(shoulder: Vec3, j: JointValues, rotationDeg: number, s: 1 | -1, a: number, b: number): { elbow: Vec3; wrist: Vec3 } {
  const L = v(1, 0, 0);
  const { U, F } = trunkFrame(j.trunk_flexion);
  const el = rad(j.shoulder_elevation);
  const pl = rad(j.shoulder_plane_of_elevation);
  // The vertical plane the arm is raised in (ISB): 0 = straight out to the side (abduction), 90 = straight forward
  // (flexion), negative = behind the frontal plane. Same convention as Tier 1's plane_of_elevation readouts.
  const plane = add(scale(L, s * Math.cos(pl)), scale(F, Math.sin(pl)));
  const humerus = add(scale(U, -Math.cos(el)), scale(plane, Math.sin(el)));
  // Where the bent forearm points at 0° rotation: forward in anatomical position, carried up through the elevation.
  const neutral = add(scale(plane, Math.cos(el)), scale(U, Math.sin(el)));
  const forearmSide = rotateAbout(neutral, scale(humerus, -s), rad(rotationDeg));
  const e = rad(j.elbow_flexion);
  const forearm = add(scale(humerus, Math.cos(e)), scale(forearmSide, Math.sin(e)));
  const elbow = add(shoulder, scale(humerus, a));
  return { elbow, wrist: add(elbow, scale(forearm, b)) };
}

const armLengths = (body: PulldownBody, s: 1 | -1) => (s === 1 ? [body.upperArm.left, body.forearm.left] : [body.upperArm.right, body.forearm.right]) as [number, number];

/** Rotations (deg) that put the hand on the bar at the grip width: where the forearm's swing crosses the bar's line. */
function rotationsOnBar(shoulder: Vec3, j: JointValues, s: 1 | -1, body: PulldownBody, gripHalf: number): { roots: number[]; closest: number } {
  const [a, b] = armLengths(body, s);
  const miss = (r: number) => s * armFromAngles(shoulder, j, r, s, a, b).wrist.x - gripHalf;
  const roots: number[] = [];
  let closest = 0;
  let closestMiss = Infinity;
  const STEP = 3;
  let prev = miss(-180);
  for (let r = -180; r < 180; r += STEP) {
    const next = miss(r + STEP);
    if (Math.abs(prev) < closestMiss) {
      closestMiss = Math.abs(prev);
      closest = r;
    }
    if (prev === 0 || prev * next < 0) {
      let lo = r;
      let hi = r + STEP;
      let mLo = prev;
      for (let k = 0; k < 30; k++) {
        const m = (lo + hi) / 2;
        const mm = miss(m);
        if (mLo * mm <= 0) hi = m;
        else {
          lo = m;
          mLo = mm;
        }
      }
      roots.push((lo + hi) / 2);
    }
    prev = next;
  }
  return { roots, closest };
}

const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const TRACK_STEPS = 200;
/** Largest plane-of-elevation change (deg) tried when the keyed angles can't put the hand on the bar. */
const MAX_PLANE_ADJUST_DEG = 60;

/** How one arm reaches the bar: its shoulder rotation, and how much its plane of elevation had to change (0 when it didn't). */
interface ArmOnBar {
  rotationDeg: number;
  planeAdjustDeg: number;
}

/**
 * Closed chain: puts the hand on the bar. Shoulder rotation is set by the bar; when no rotation reaches it with the keyed
 * elevation, plane and elbow flexion (e.g. after a grip change), the plane of elevation swings the elbow out or in by
 * the smallest amount that does. Among several solutions, the one nearest `prev` (or at the top, the one holding the hand highest).
 */
function armOnBar(shoulder: Vec3, j: JointValues, s: 1 | -1, body: PulldownBody, gripHalf: number, prev?: ArmOnBar): ArmOnBar {
  const [a, b] = armLengths(body, s);
  for (let k = 0; k <= 2 * MAX_PLANE_ADJUST_DEG; k++) {
    // 0, +0.5, −0.5, +1, … (half-degree steps), starting from the previous adjustment so it stays continuous.
    const base = prev?.planeAdjustDeg ?? 0;
    const d = base + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5;
    const jj = { ...j, shoulder_plane_of_elevation: j.shoulder_plane_of_elevation + d };
    const { roots } = rotationsOnBar(shoulder, jj, s, body, gripHalf);
    if (!roots.length) continue;
    const pick = prev
      ? roots.reduce((x, y) => (Math.abs(wrapDeg(y - prev.rotationDeg)) < Math.abs(wrapDeg(x - prev.rotationDeg)) ? y : x))
      : roots.reduce((x, y) => (armFromAngles(shoulder, jj, y, s, a, b).wrist.y > armFromAngles(shoulder, jj, x, s, a, b).wrist.y ? y : x));
    return { rotationDeg: pick, planeAdjustDeg: d };
  }
  return { rotationDeg: prev?.rotationDeg ?? 0, planeAdjustDeg: prev?.planeAdjustDeg ?? 0 };
}

const trackCache = new Map<string, ArmOnBar[]>();

/**
 * One arm's closed-chain solution over the pull, at TRACK_STEPS + 1 points of its own progress. Each step starts from
 * the last, so the arm never flips to the other way of reaching the bar mid-rep.
 */
function armTrack(p: PulldownProfile, s: 1 | -1): ArmOnBar[] {
  const body = bodyOf(p);
  const key = JSON.stringify([p.joints, p.gripWidthXShoulder, body, s]);
  const hit = trackCache.get(key);
  if (hit) return hit;
  if (trackCache.size > 64) trackCache.clear();
  const track: ArmOnBar[] = [];
  for (let i = 0; i <= TRACK_STEPS; i++) {
    const j = jointsAt(p, i / TRACK_STEPS);
    track.push(armOnBar(shoulderAt(j, s, body), j, s, body, gripHalfWidth(p), track[i - 1]));
  }
  trackCache.set(key, track);
  return track;
}

/**
 * The arm's closed-chain angles at its progress `prog`: shoulder rotation (+ = external) set by the bar, and the
 * plane of elevation actually used (the keyed value unless the hand couldn't reach the bar with it).
 */
export function pulldownArmOnBar(p: PulldownProfile, prog: number, side: "left" | "right" = "left"): { shoulderRotationDeg: number; shoulderPlaneOfElevationDeg: number } {
  const s = side === "left" ? 1 : -1;
  const track = armTrack(p, s);
  const x = Math.min(1, Math.max(0, prog)) * TRACK_STEPS;
  const i = Math.min(TRACK_STEPS - 1, Math.floor(x));
  const t = x - i;
  const guess: ArmOnBar = {
    rotationDeg: track[i]!.rotationDeg + wrapDeg(track[i + 1]!.rotationDeg - track[i]!.rotationDeg) * t,
    planeAdjustDeg: track[i]!.planeAdjustDeg + (track[i + 1]!.planeAdjustDeg - track[i]!.planeAdjustDeg) * t,
  };
  const body = bodyOf(p);
  const j = jointsAt(p, prog);
  const jj = { ...j, shoulder_plane_of_elevation: j.shoulder_plane_of_elevation + guess.planeAdjustDeg };
  // Snap to the exact on-bar rotation nearest the tracked one.
  const { roots } = rotationsOnBar(shoulderAt(jj, s, body), jj, s, body, gripHalfWidth(p));
  const rot = roots.length ? roots.reduce((r1, r2) => (Math.abs(wrapDeg(r2 - guess.rotationDeg)) < Math.abs(wrapDeg(r1 - guess.rotationDeg)) ? r2 : r1)) : guess.rotationDeg;
  return { shoulderRotationDeg: rot, shoulderPlaneOfElevationDeg: jj.shoulder_plane_of_elevation };
}

/** Full 33-point pose in the body frame for rep progress `prog`. */
export function poseAt(prog: number, p: PulldownProfile): Body {
  const L = v(1, 0, 0);
  const U = v(0, 1, 0);
  const F = v(0, 0, 1);
  const body = bodyOf(p);
  const j = jointsAt(p, prog);
  const trunkAxis = trunkFrame(j.trunk_flexion).U;
  const neckBase = scale(trunkAxis, body.trunk); // head does not move with the shoulder girdle

  const pose = {} as Body;
  for (const [side, s] of [["left", 1], ["right", -1]] as const) {
    const armProg = side === "right" && p.rightArmLag ? prog * (1 - p.rightArmLag) : prog;
    // The trunk is shared: only the arm and girdle lag.
    const jArm = { ...jointsAt(p, armProg), trunk_flexion: j.trunk_flexion };
    const shoulder = shoulderAt(jArm, s, body);
    const [a, b] = armLengths(body, s);
    const onBar = pulldownArmOnBar(p, armProg, side);
    const { elbow, wrist } = armFromAngles(shoulder, { ...jArm, shoulder_plane_of_elevation: onBar.shoulderPlaneOfElevationDeg }, onBar.shoulderRotationDeg, s, a, b);
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
