import type { PoseSequence, RepSegment } from "@optimass/types";
import { pulldownSeries } from "./pulldown/metrics";
import { segmentPulldownReps } from "./pulldown/segment";

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

/** Exercises with a kinematics pipeline so far. Everything else still throws. */
const VERTICAL_PULLS = new Set(["lat_pulldown"]);

export function analyzeKinematics(sequence: PoseSequence): KinematicAnalysis {
  if (VERTICAL_PULLS.has(sequence.exerciseId)) {
    const series = pulldownSeries(sequence);
    return { series, reps: segmentPulldownReps(series) };
  }
  return notImplemented(`analyzeKinematics(${sequence.exerciseId})`);
}

export * from "./vec3";
export * from "./signal";
export * as pulldown from "./pulldown";
export * as posture from "./posture";
export * as body from "./body";
export * from "./camera";
