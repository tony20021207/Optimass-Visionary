import type { PoseSequence, RepSegment } from "@optimass/types";

export const MODULE = "M5" as const;

/** Per-frame time series of named metrics, e.g. "left_knee_flexion_deg". */
export interface KinematicSeries {
  timestampsMs: number[];
  metrics: Record<string, number[]>;
}

export interface KinematicAnalysis {
  series: KinematicSeries;
  reps: RepSegment[];
}

const notImplemented = (fn: string): never => {
  throw new Error(`${fn} is not implemented yet (M5, see docs/specs/M5.md)`);
};

export function analyzeKinematics(_sequence: PoseSequence): KinematicAnalysis {
  return notImplemented("analyzeKinematics");
}
