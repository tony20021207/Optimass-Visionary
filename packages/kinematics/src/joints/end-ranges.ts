import rangesJson from "./end-ranges.json";
import { JOINT_MOTIONS, type JointMotionId } from "./catalogue";

/**
 * Anatomical end ranges (end-ranges.json, PLACEHOLDER until Tony sets them): how far each joint motion can go in its
 * − and + direction. The simulation and Motion Lab stop there, so a check only needs the side a form error can exceed
 * (Tony, 2026-10-10). A missing or null side means no anatomical stop.
 */
export interface JointEndRange {
  min: number | null;
  max: number | null;
  why?: string;
}

export const JOINT_END_RANGES: Partial<Record<JointMotionId, JointEndRange>> = (rangesJson as { ranges: Record<string, JointEndRange> }).ranges;

/** [min, max] for a motion: its end range where set, else its display range. */
export function jointLimits(id: JointMotionId): [number, number] {
  const r = JOINT_END_RANGES[id];
  const [lo, hi] = JOINT_MOTIONS[id].displayRange;
  return [r?.min ?? lo, r?.max ?? hi];
}

/** Stops a value at the motion's end range (unchanged where none is set). */
export function clampToEndRange(id: JointMotionId, value: number): number {
  const r = JOINT_END_RANGES[id];
  if (r?.min != null && value < r.min) return r.min;
  if (r?.max != null && value > r.max) return r.max;
  return value;
}
