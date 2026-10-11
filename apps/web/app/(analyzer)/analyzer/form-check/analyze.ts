import { body, posture, pulldown } from "@optimass/kinematics";
import type { PoseSequence } from "@optimass/types";
import { buildFormReport } from "./form-report";
import type { FormReportView } from "./form-report";
import type { AnalyzeBaseline, SkeletonLike } from "./baseline";
import type { Variation } from "./FormCheck";

/** Grip variations Tier 1 has baselines for (PULLDOWN_SETUPS). Wide overhand is Tony's main baseline. */
export const PULLDOWN_VARIATIONS: Variation[] = [
  { id: "wide_overhand", label: "Wide overhand" },
  { id: "narrow_underhand", label: "Narrow underhand" },
  { id: "neutral_bar", label: "Neutral bar" },
  { id: "close_v_bar", label: "Close V-bar" },
];

/** Tier 1 on a tracked set: reps, per-rep features, and checks against that grip's limits. */
export function analyzePulldownSet(sequence: PoseSequence, variation: string, skeleton?: SkeletonLike): FormReportView {
  const params = pulldown.pulldownParamsFor(pulldown.DEFAULT_PULLDOWN_PARAMS, variation);
  const options = skeleton ? { skeleton: skeleton as body.Skeleton } : {};
  return buildFormReport(pulldown.analyzePulldown(sequence, params, options), params);
}

/** Posture check: personal skeleton (bone lengths, proportions, sides) and Tier 1's standing-posture checks. */
export const analyzeBaseline: AnalyzeBaseline = (captures, heightCm) => {
  const skeleton = body.calibrateSkeleton(captures, heightCm ? { heightM: heightCm / 100 } : {});
  const report = posture.analyzePosture(captures);
  return { heightCm, skeleton, posture: report.checks };
};
