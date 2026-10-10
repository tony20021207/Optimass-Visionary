import type { Tier2Rules } from "./tier2/infer";
import { rankRootCauses } from "./tier2/infer";
import type { CameraView, CorrectivePrescription, DiagnosticReport, KinematicFinding, RepSegment, RootCauseHypothesis } from "@optimass/types";

export const MODULE = "M6" as const;

export { parseTier2Rules, rankRootCauses } from "./tier2/infer";
export type { Tier2Rules } from "./tier2/infer";
export { Tier2Cause, Tier2Pattern, Tier2Table } from "./tier2/schema";
export { coachSet, formatTime, parseCoachingTable } from "./coaching/coach";
export type { Cue, CueKind, SetCoaching } from "./coaching/coach";
export { CoachingTable, SetFeedback } from "./coaching/schema";
export { pickReviewRep } from "./coaching/pick-rep";
export type { RepWindow } from "./coaching/pick-rep";
/** Hand-written pulldown findings, used as stand-in Tier 1 output until real clips are analysed. */
export { pulldownFrontalFindings, pulldownSagittalFindings } from "./tier2/fixtures";

/** Kinematics output as diagnostics sees it (structurally matches @optimass/kinematics' KinematicAnalysis). */
export interface KinematicInput {
  exerciseId: string;
  cameraView: CameraView;
  series: { timestampsMs: number[]; metrics: Record<string, number[]> };
  reps: RepSegment[];
}

/** Rule tables loaded from content/rules/tier1..tier3. */
export interface RuleSet {
  version: { tier1: string; tier2: string; tier3: string };
  /** Tier 2 tables (content/rules/tier2), parsed with parseTier2Rules. */
  tier2?: Tier2Rules;
}

const notImplemented = (fn: string): never => {
  throw new Error(`${fn} is not implemented yet (see docs/specs/M6a.md … M6c.md)`);
};

export function loadRuleSet(_contentDir: string): RuleSet {
  return notImplemented("loadRuleSet");
}

/** Tier 1 (M6a). Only rules whose required view matches input.cameraView may fire. */
export function detectFindings(_input: KinematicInput, _rules: RuleSet): KinematicFinding[] {
  return notImplemented("detectFindings");
}

/** Tier 2 (M6b). Ranked hypotheses (rank 1 = most likely), each with its confirming screening test. Never a diagnosis. */
export function inferRootCauses(findings: readonly KinematicFinding[], rules: RuleSet): RootCauseHypothesis[] {
  if (!rules.tier2) throw new Error("inferRootCauses needs rules.tier2 (parse content/rules/tier2 with parseTier2Rules)");
  return rankRootCauses(findings, rules.tier2);
}

/** Tier 3 (M6c). */
export function prescribeCorrectives(_hypotheses: readonly RootCauseHypothesis[], _rules: RuleSet): CorrectivePrescription[] {
  return notImplemented("prescribeCorrectives");
}

/** Runs all three tiers and assembles a DiagnosticReport. */
export function diagnose(_input: KinematicInput, _rules: RuleSet): DiagnosticReport {
  return notImplemented("diagnose");
}
