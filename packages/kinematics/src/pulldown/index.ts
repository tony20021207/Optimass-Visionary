import type { PoseSequence, RepSegment } from "@optimass/types";
import type { KinematicSeries } from "../index";
import { evaluatePulldownRep, type CheckResult, type PulldownParams } from "./evaluate";
import { pulldownFeatures, type PulldownFeatures } from "./features";
import { pulldownSeries, type MetricOptions } from "./metrics";
import { segmentPulldownReps } from "./segment";

export * from "./evaluate";
export * from "./features";
export * from "./metrics";
export * from "./segment";
export * from "./synth";

export interface PulldownRepReport {
  rep: RepSegment;
  features: PulldownFeatures;
  checks: CheckResult[];
}

export interface PulldownReport {
  series: KinematicSeries;
  reps: PulldownRepReport[];
}

/** Clip → per-frame series → reps → per-rep features → checks against the parameter file. */
export function analyzePulldown(seq: PoseSequence, params?: PulldownParams, options?: MetricOptions): PulldownReport {
  const series = pulldownSeries(seq, options);
  const reps = segmentPulldownReps(series).map((rep) => {
    const features = pulldownFeatures(series, rep);
    return { rep, features, checks: evaluatePulldownRep(features, params) };
  });
  return { series, reps };
}
