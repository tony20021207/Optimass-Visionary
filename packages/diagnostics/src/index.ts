import type { CameraView, CorrectivePrescription, DiagnosticReport, KinematicFinding, RepSegment, RootCauseHypothesis } from "@optimass/types";

export const MODULE = "M6" as const;

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

/** Tier 2 (M6b). */
export function inferRootCauses(_findings: readonly KinematicFinding[], _rules: RuleSet): RootCauseHypothesis[] {
  return notImplemented("inferRootCauses");
}

/** Tier 3 (M6c). */
export function prescribeCorrectives(_hypotheses: readonly RootCauseHypothesis[], _rules: RuleSet): CorrectivePrescription[] {
  return notImplemented("prescribeCorrectives");
}

/** Runs all three tiers and assembles a DiagnosticReport. */
export function diagnose(_input: KinematicInput, _rules: RuleSet): DiagnosticReport {
  return notImplemented("diagnose");
}
