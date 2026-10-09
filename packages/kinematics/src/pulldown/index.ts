import type { PoseSequence, RepSegment } from "@optimass/types";
import { fitToSkeleton, type FitResult, type Skeleton } from "../body";
import type { KinematicSeries } from "../index";
import { evaluatePulldownRep, type CheckResult, type PulldownParams } from "./evaluate";
import { pulldownFeatures, type PulldownFeatures } from "./features";
import { armDimensionsFromSkeleton, recommendedGrip, type GripRule, type RecommendedGrip } from "./grip";
import { pulldownSeries, type MetricOptions } from "./metrics";
import { segmentPulldownReps } from "./segment";

export * from "./evaluate";
export * from "./features";
export * from "./grip";
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
  /** Present when a personal skeleton was passed: the grip its arm lengths call for. */
  recommendedGrip?: RecommendedGrip;
}

export interface PulldownAnalysisOptions extends MetricOptions {
  /** Personal skeleton from the posture check. When given, the clip is fitted to it before measuring. */
  skeleton?: Skeleton;
  /** Rule for the recommended grip (defaults to DEFAULT_GRIP_RULE). */
  gripRule?: GripRule;
}

/** Clip → (fit to skeleton) → per-frame series → reps → per-rep features → checks against the parameter file. */
export function analyzePulldown(seq: PoseSequence, params?: PulldownParams, options: PulldownAnalysisOptions = {}): PulldownReport {
  let fit: FitResult | undefined;
  if (options.skeleton) {
    fit = fitToSkeleton(seq, options.skeleton);
    seq = fit.sequence;
  }
  const series = pulldownSeries(seq, options);
  const grip = options.skeleton && recommendedGrip(armDimensionsFromSkeleton(options.skeleton), options.gripRule);
  const reps = segmentPulldownReps(series).map((rep) => {
    const features = pulldownFeatures(series, rep);
    if (grip) features.grip_vs_recommended = features.grip_width_x_shoulder / grip.gripWidthXShoulder;
    return { rep, features, checks: evaluatePulldownRep(features, params) };
  });
  return { series, reps, ...(fit && { fit: { maxBoneErrorM: fit.maxBoneErrorM } }), ...(grip && { recommendedGrip: grip }) };
}
