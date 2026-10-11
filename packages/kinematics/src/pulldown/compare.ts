// Compares each filmed rep to the user's own good rep (Tony, 2026-10-11): the grip's Motion Lab baseline keyframes run on
// the user's posture-check bones, measured through the same pipeline as the clip, at Top / ⅓ / ⅔ / Bottom.
import type { RepSegment } from "@optimass/types";
import type { Skeleton } from "../body";
import type { KinematicSeries } from "../index";
import defaultParamsJson from "./ideal-compare.params.json";
import { pulldownSeries } from "./metrics";
import { segmentPulldownReps } from "./segment";
import {
  barProgressAt,
  PULLDOWN_KEY_AT,
  PULLDOWN_SETUPS,
  pulldownBodyFromSkeleton,
  synthesizePulldown,
  type PulldownProfile,
  type PulldownScapulaRest,
  type PulldownSetup,
} from "./synth";

/** The four keyframes, as in Motion Lab: Top, ⅓, ⅔, Bottom of the pull. */
export const PULLDOWN_COMPARE_KEYS = ["top", "third1", "third2", "bottom"] as const;
export type PulldownCompareKey = (typeof PULLDOWN_COMPARE_KEYS)[number];

/**
 * What is compared, in clinical terms. The two scapular items are proxies (MediaPipe has no scapula landmarks):
 * elevation from the ear-to-shoulder gap, protraction from the shoulders' distance ahead of the hip-to-ear line.
 */
export const PULLDOWN_COMPARE_JOINTS = [
  "trunk_flexion",
  "shoulder_elevation",
  "shoulder_plane_of_elevation",
  "shoulder_rotation",
  "elbow_flexion",
  "scapular_elevation",
  "scapular_protraction",
] as const;
export type PulldownCompareJoint = (typeof PULLDOWN_COMPARE_JOINTS)[number];

export type PulldownCompareSide = "left" | "right" | "both";

export interface PulldownCompareParams {
  exerciseId: string;
  version: string;
  reviewedBy: string | null;
  joints: Record<PulldownCompareJoint, { tolerance: number; unit: string }>;
}

export const DEFAULT_PULLDOWN_COMPARE_PARAMS = defaultParamsJson as PulldownCompareParams;

/** Readout of each compared joint at one moment, in the units of the params file. NaN = not measurable there. */
export type PulldownJointReadout = Record<PulldownCompareJoint, number>;

/**
 * Readouts at one frame. Signs: + = flexion, elevation, external rotation, protraction (trunk_flexion − = leaning
 * back). scapular_elevation is the negated ear-to-shoulder gap (÷ shoulder width), so a shrug makes it go up.
 */
export function pulldownJointReadout(series: KinematicSeries, frame: number, side: PulldownCompareSide = "both"): PulldownJointReadout {
  const m = series.metrics;
  const at = (name: string) => m[name]?.[frame] ?? Number.NaN;
  const sided = (suffix: string) => {
    if (side !== "both") return at(`${side}_${suffix}`);
    const xs = [at(`left_${suffix}`), at(`right_${suffix}`)].filter(Number.isFinite);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.NaN;
  };
  return {
    trunk_flexion: -at("trunk_lean_deg"),
    shoulder_elevation: sided("humerothoracic_elevation_deg"),
    shoulder_plane_of_elevation: sided("plane_of_elevation_deg"),
    shoulder_rotation: sided("shoulder_rotation_deg"),
    elbow_flexion: sided("elbow_flexion_deg"),
    scapular_elevation: -sided("shoulder_ear_gap_ratio"),
    scapular_protraction: at("shoulder_forward_of_hip_ear_m") / at("trunk_length_m"),
  };
}

/** Median readout over a few frames (each joint on its own, ignoring frames where it can't be measured). */
function readoutOver(series: KinematicSeries, frames: number[], side: PulldownCompareSide): PulldownJointReadout {
  const rs = frames.map((f) => pulldownJointReadout(series, f, side));
  const out = {} as PulldownJointReadout;
  for (const j of PULLDOWN_COMPARE_JOINTS) {
    const xs = rs.map((r) => r[j]).filter(Number.isFinite);
    out[j] = xs.length ? median(xs) : Number.NaN;
  }
  return out;
}

/** The user's good rep, measured: readouts at each key and where each key sits along the bar's travel. */
export interface PulldownIdeal {
  setup?: PulldownSetup;
  side: PulldownCompareSide;
  keys: { key: PulldownCompareKey; barTravel: number; joints: PulldownJointReadout }[];
}

export interface PulldownIdealOptions {
  /** Grip variation whose baseline is the good rep. Default wide_overhand. */
  setup?: PulldownSetup;
  /** The good rep's settings when they differ from the repo baseline (e.g. Tony's latest Motion Lab baseline). */
  profile?: PulldownProfile;
  /** The user's posture-check skeleton: the good rep moves these bones. */
  skeleton?: Skeleton;
  /** The user's resting clavicle position (pulldownScapulaRestFromPosture). */
  scapulaRest?: PulldownScapulaRest;
  /** Which arm to read: the filmed (near) side, or both averaged. Default both. */
  side?: PulldownCompareSide;
}

/**
 * The rep's top (frames where the bar is at its highest in the second before the pull starts: the rep's own start frame
 * is already a few percent down, see segment.ts) and how far along the pull the bar is at each frame: 0 = top, 1 = the
 * bottom pause's median height.
 */
function repGeometry(series: KinematicSeries, rep: RepSegment): { topFrames: number[]; travel: (frame: number) => number } {
  const h = series.metrics.wrist_mid_height_m ?? [];
  const t = series.timestampsMs;
  const bottom = rep.phases.find((p) => p.phase === "bottom_pause")!;
  const low = median(framesBetween(t, bottom.startMs, bottom.endMs).map((f) => h[f]!));
  const before = framesBetween(t, t[rep.startFrame]! - TOP_LOOKBACK_MS, t[rep.startFrame]!);
  const high = Math.max(...before.map((f) => h[f]!));
  const topFrames = before.filter((f) => h[f]! >= high - TOP_BAND * (high - low));
  return { topFrames, travel: (f) => (high - h[f]!) / (high - low) };
}

/** Signal-processing choices, not clinical values: how far back to look for the top, and what counts as "at the top". */
const TOP_LOOKBACK_MS = 1000;
const TOP_BAND = 0.01;

function framesBetween(t: number[], fromMs: number, toMs: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < t.length; i++) if (t[i]! >= fromMs && t[i]! <= toMs) out.push(i);
  return out;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

const around = (f: number, lo: number, hi: number) => [f - 1, f, f + 1].filter((x) => x >= lo && x <= hi);

const idealCache = new Map<string, PulldownIdeal>();

/**
 * Builds the user's good rep: the variation's baseline (or `profile`) on the user's bones, rendered without noise and
 * measured exactly as a filmed clip is. The ⅓ and ⅔ keys are where the keyframes sit on the bar's travel, so a filmed rep
 * is compared at the same bar position whatever its pacing (pacing is checked separately).
 */
export function pulldownIdeal(options: PulldownIdealOptions = {}): PulldownIdeal {
  const side = options.side ?? "both";
  const base = options.profile ?? PULLDOWN_SETUPS[options.setup ?? "wide_overhand"];
  const profile: PulldownProfile = {
    ...base,
    reps: 1,
    noiseM: 0,
    tempoDrift: 0,
    ...(options.skeleton && { body: pulldownBodyFromSkeleton(options.skeleton) }),
    ...(options.scapulaRest && { scapulaRest: options.scapulaRest }),
  };
  const cacheKey = JSON.stringify([profile, side]);
  const hit = idealCache.get(cacheKey);
  if (hit) return { ...hit, setup: options.setup };

  const series = pulldownSeries(synthesizePulldown(profile));
  const rep = segmentPulldownReps(series)[0];
  if (!rep) throw new Error("pulldownIdeal: the good rep did not segment (check the profile's range of motion)");
  const t = series.timestampsMs;
  const { topFrames, travel } = repGeometry(series, rep);
  const con = rep.phases.find((p) => p.phase === "concentric")!;
  const bottom = rep.phases.find((p) => p.phase === "bottom_pause")!;
  const last = t.length - 1;
  const keys: PulldownIdeal["keys"] = [{ key: "top", barTravel: 0, joints: readoutOver(series, topFrames, side) }];
  for (const k of [1, 2] as const) {
    let f = framesBetween(t, con.startMs, con.endMs).find((i) => barProgressAt(t[i]! / 1000, profile) >= PULLDOWN_KEY_AT[k]!);
    f ??= rep.startFrame;
    keys.push({ key: PULLDOWN_COMPARE_KEYS[k], barTravel: travel(f), joints: readoutOver(series, around(f, 0, last), side) });
  }
  keys.push({ key: "bottom", barTravel: 1, joints: readoutOver(series, framesBetween(t, bottom.startMs, bottom.endMs), side) });

  const ideal = { side, keys };
  if (idealCache.size > 32) idealCache.clear();
  idealCache.set(cacheKey, ideal);
  return { ...ideal, setup: options.setup };
}

export interface PulldownJointComparison {
  measured: number;
  ideal: number;
  /** measured − ideal, in the joint's unit (plane of elevation wrapped to ±180°). + = more of the named joint function. */
  diff: number;
  tolerance: number;
  unit: string;
  /** off = past its tolerance; unmeasured = not visible at this key in the clip or the good rep. */
  status: "ok" | "off" | "unmeasured";
}

export interface PulldownKeyComparison {
  key: PulldownCompareKey;
  /** Clip time of the key (ms). */
  atMs: number;
  joints: Record<PulldownCompareJoint, PulldownJointComparison>;
}

export interface PulldownRepComparison {
  /** 0–100: how close the rep is to the user's good rep (100 = matches at every key). PLACEHOLDER formula. */
  score: number;
  keys: PulldownKeyComparison[];
  /** Joints past their tolerance, worst (most tolerances away) first. */
  off: { key: PulldownCompareKey; joint: PulldownCompareJoint; diff: number; tolerance: number; unit: string }[];
}

/** Compares one segmented rep of a clip to the user's good rep. */
export function comparePulldownRep(
  series: KinematicSeries,
  rep: RepSegment,
  ideal: PulldownIdeal,
  params: PulldownCompareParams = DEFAULT_PULLDOWN_COMPARE_PARAMS,
): PulldownRepComparison {
  const t = series.timestampsMs;
  const last = t.length - 1;
  const { topFrames, travel } = repGeometry(series, rep);
  const con = rep.phases.find((p) => p.phase === "concentric")!;
  const bottom = rep.phases.find((p) => p.phase === "bottom_pause")!;
  const conFrames = framesBetween(t, con.startMs, con.endMs);
  const bottomFrames = framesBetween(t, bottom.startMs, bottom.endMs);

  const keys: PulldownKeyComparison[] = [];
  const off: PulldownRepComparison["off"] = [];
  const scores: number[] = [];
  for (const target of ideal.keys) {
    let frames: number[];
    let atFrame: number;
    if (target.key === "top") [frames, atFrame] = [topFrames, topFrames[topFrames.length - 1] ?? rep.startFrame];
    else if (target.key === "bottom") [frames, atFrame] = [bottomFrames, bottomFrames[0] ?? rep.startFrame];
    else {
      atFrame = conFrames.find((f) => travel(f) >= target.barTravel) ?? conFrames[conFrames.length - 1] ?? rep.startFrame;
      frames = around(atFrame, 0, last);
    }
    const measured = readoutOver(series, frames, ideal.side);
    const joints = {} as PulldownKeyComparison["joints"];
    for (const j of PULLDOWN_COMPARE_JOINTS) {
      const { tolerance, unit } = params.joints[j];
      const m = measured[j];
      const i = target.joints[j];
      let diff = m - i;
      if (j === "shoulder_plane_of_elevation") diff = ((((diff + 180) % 360) + 360) % 360) - 180;
      const ok = Number.isFinite(diff);
      const status = !ok ? "unmeasured" : Math.abs(diff) > tolerance ? "off" : "ok";
      joints[j] = { measured: m, ideal: i, diff, tolerance, unit, status };
      if (ok) scores.push(Math.max(0, 1 - Math.abs(diff) / (2 * tolerance)));
      if (status === "off") off.push({ key: target.key, joint: j, diff, tolerance, unit });
    }
    keys.push({ key: target.key, atMs: t[atFrame]!, joints });
  }
  off.sort((a, b) => Math.abs(b.diff) / b.tolerance - Math.abs(a.diff) / a.tolerance);
  const score = scores.length ? Math.round((100 * scores.reduce((a, b) => a + b, 0)) / scores.length) : 0;
  return { score, keys, off };
}
