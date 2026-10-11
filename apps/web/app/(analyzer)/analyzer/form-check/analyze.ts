import { body, posture, pulldown } from "@optimass/kinematics";
import type { PoseSequence } from "@optimass/types";
import { buildFormReport } from "./form-report";
import type { FormReportView } from "./form-report";
import type { AnalyzeBaseline, ScapulaRestLike, SkeletonLike } from "./baseline";
import type { Variation } from "./FormCheck";

/** Grip variations Tier 1 has baselines for (PULLDOWN_SETUPS). Wide overhand is Tony's main baseline. */
export const PULLDOWN_VARIATIONS: Variation[] = [
  { id: "wide_overhand", label: "Wide overhand" },
  { id: "narrow_underhand", label: "Narrow underhand" },
  { id: "neutral_bar", label: "Neutral bar" },
  { id: "close_v_bar", label: "Close V-bar" },
];

export type FilmedSide = "left" | "right" | "both";

export interface AnalyzeContext {
  /** From the posture check. Without it the good rep is built on Tier 1's default body. */
  skeleton?: SkeletonLike;
  scapulaRest?: ScapulaRestLike;
  /** Side of the lifter the camera was on; that (near) arm is read. "both" averages the two arms. */
  side?: FilmedSide;
}

/**
 * Tier 1 on a tracked set: reps, per-rep features, checks against that grip's limits, and each rep compared to
 * the user's good rep (the grip's Motion Lab baseline played on their own bones, pulldownIdeal).
 */
export function analyzePulldownSet(sequence: PoseSequence, variation: string, ctx: AnalyzeContext = {}): FormReportView {
  const params = pulldown.pulldownParamsFor(pulldown.DEFAULT_PULLDOWN_PARAMS, variation);
  const report = pulldown.analyzePulldown(sequence, params, {
    ...(ctx.skeleton && { skeleton: ctx.skeleton as body.Skeleton }),
    compare: {
      setup: variation as pulldown.PulldownSetup,
      side: ctx.side ?? "both",
      ...(ctx.scapulaRest && { scapulaRest: ctx.scapulaRest }),
    },
  });
  return buildFormReport(report, params, { personal: Boolean(ctx.skeleton), compareParams: pulldown.DEFAULT_PULLDOWN_COMPARE_PARAMS });
}

/** Posture check: personal skeleton (bone lengths, proportions, sides) and Tier 1's standing-posture checks. */
export const analyzeBaseline: AnalyzeBaseline = (captures, heightCm) => {
  const skeleton = body.calibrateSkeleton(captures, heightCm ? { heightM: heightCm / 100 } : {});
  const report = posture.analyzePosture(captures);
  const rest = pulldown.pulldownScapulaRestFromPosture(posture.postureScreen(captures));
  // A view the shoulders couldn't be read in gives NaN; the good rep then starts from the model's neutral.
  const usable = [rest.left, rest.right].every((s) => Number.isFinite(s.elevationDeg) && Number.isFinite(s.protractionDeg));
  return { heightCm, skeleton, posture: report.checks, ...(usable && { scapulaRest: rest }) };
};
