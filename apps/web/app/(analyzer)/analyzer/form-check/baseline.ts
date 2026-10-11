// The lifter's baseline: measurements from the 4-view posture check, kept on this phone (no photos).
import type { PoseSequence } from "@optimass/types";

export type PostureViewId = "anterior" | "posterior" | "left" | "right";
export const POSTURE_VIEWS: PostureViewId[] = ["anterior", "posterior", "left", "right"];

/** Same shape as Tier 1's Skeleton (packages/kinematics body/skeleton.ts), written out so this file stays data-only. */
export interface SkeletonLike {
  segments: Record<string, { lengthM: number; perView: Record<string, number>; spread: number }>;
  proportions: Record<string, number>;
  sideDifferenceM: Record<string, number>;
  scale: number;
}

export interface PostureResult {
  id: string;
  feature: string;
  value: number;
  min?: number;
  max?: number;
  status: "pass" | "fail" | "info";
  finding?: string;
}

/** Resting clavicle position per side, in degrees (Tier 1's PulldownScapulaRest). The good rep starts from it. */
export interface ScapulaRestLike {
  left: { elevationDeg: number; protractionDeg: number };
  right: { elevationDeg: number; protractionDeg: number };
}

export interface Baseline {
  version: 1;
  savedAt: string;
  heightCm?: number;
  skeleton: SkeletonLike;
  posture: PostureResult[];
  /** Missing on baselines saved before the good-rep comparison (2026-10-11). */
  scapulaRest?: ScapulaRestLike;
}

export type AnalyzeBaseline = (captures: { view: PostureViewId; sequence: PoseSequence }[], heightCm?: number) => Omit<Baseline, "version" | "savedAt">;

const KEY = "optimass.baseline.v1";

export function loadBaseline(): Baseline | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as Baseline;
    return b && b.version === 1 && b.skeleton?.segments ? b : null;
  } catch {
    return null;
  }
}

/** Returns false when this browser won't keep it (private mode, blocked storage). */
export function saveBaseline(b: Baseline): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
    return true;
  } catch {
    return false;
  }
}

/** The measurements worth showing, in cm. */
export function keyMeasurements(s: SkeletonLike): { id: string; cm: number; diffCm?: number }[] {
  const p = s.proportions;
  const cm = (m: number | undefined) => Math.round((m ?? Number.NaN) * 1000) / 10;
  return [
    { id: "upper_arm", cm: cm(p.upper_arm_m), diffCm: cm(s.sideDifferenceM.upper_arm) },
    { id: "forearm", cm: cm(p.forearm_m), diffCm: cm(s.sideDifferenceM.forearm) },
    { id: "trunk", cm: cm(p.trunk_m) },
    { id: "shoulder_width", cm: cm(s.segments.shoulder_width?.lengthM) },
    { id: "thigh", cm: cm(p.thigh_m), diffCm: cm(s.sideDifferenceM.thigh) },
    { id: "shin", cm: cm(p.shin_m), diffCm: cm(s.sideDifferenceM.shin) },
  ];
}
