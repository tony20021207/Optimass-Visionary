import type { PoseSequence, RepSegment } from "@optimass/types";
import { fitToSkeleton, type FitResult, type Skeleton } from "../body";
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
  /** Present when a personal skeleton was passed: how far the raw tracking strayed from it. */
  fit?: Omit<FitResult, "sequence">;
}

export interface PulldownAnalysisOptions extends MetricOptions {
  /** Personal skeleton from the posture check. When given, the clip is fitted to it before measuring. */
  skeleton?: Skeleton;
}

/** Clip → (fit to skeleton) → per-frame series → reps → per-rep features → checks against the parameter file. */
export function analyzePulldown(seq: PoseSequence, params?: PulldownParams, options: PulldownAnalysisOptions = {}): PulldownReport {
  let fit: FitResult | undefined;
  if (options.skeleton) {
    fit = fitToSkeleton(seq, options.skeleton);
    seq = fit.sequence;
  }
  const series = pulldownSeries(seq, options);
  const reps = segmentPulldownReps(series).map((rep) => {
    const features = pulldownFeatures(series, rep);
    return { rep, features, checks: evaluatePulldownRep(features, params) };
  });
  return { series, reps, ...(fit && { fit: { maxBoneErrorM: fit.maxBoneErrorM } }) };
}
