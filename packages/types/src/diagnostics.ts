import { z } from "zod";
import { CameraView, IsoDateTime, Side, Slug, UnitInterval } from "./common";
import { JointId } from "./anatomy";
import { RepSegment } from "./pose";

export const Severity = z.enum(["minor", "moderate", "major"]);
export type Severity = z.infer<typeof Severity>;

/** Tier 1: an observed kinematic error, produced by evaluating a content/rules/tier1 rule against kinematics output. */
export const KinematicFinding = z.object({
  id: z.string().min(1),
  ruleId: Slug,
  exerciseId: Slug,
  /** Stable error code, e.g. "knee_valgus", "lumbar_flexion_at_depth". */
  errorCode: Slug,
  label: z.string().min(1),
  /** The camera view the rule needs. A finding is only valid if the clip was filmed from this view. */
  requiredView: CameraView,
  severity: Severity,
  side: Side,
  repIndices: z.array(z.number().int().nonnegative()).min(1),
  evidence: z
    .array(
      z.object({
        metric: z.string().min(1),
        value: z.number(),
        threshold: z.number(),
        unit: z.string().min(1),
      }),
    )
    .min(1),
  confidence: UnitInterval,
});
export type KinematicFinding = z.infer<typeof KinematicFinding>;

export const RootCauseCategory = z.enum(["mobility", "motor_control", "strength", "anatomical_variation", "technique", "equipment"]);
export type RootCauseCategory = z.infer<typeof RootCauseCategory>;

/** A clinical screen that confirms or rules out a hypothesis (e.g. knee-to-wall, Thomas test). */
export const ScreeningTest = z.object({
  id: Slug,
  name: z.string().min(1),
  procedure: z.string().min(1),
  positiveCriterion: z.string().min(1),
});
export type ScreeningTest = z.infer<typeof ScreeningTest>;

/** Tier 2: a ranked anatomical hypothesis for one or more findings. Never a diagnosis. */
export const RootCauseHypothesis = z.object({
  id: z.string().min(1),
  findingIds: z.array(z.string().min(1)).min(1),
  category: RootCauseCategory,
  label: z.string().min(1),
  structures: z.object({
    muscles: z.array(Slug).default([]),
    joints: z.array(JointId).default([]),
  }),
  /** 1 = most likely. */
  rank: z.number().int().positive(),
  likelihood: UnitInterval,
  /** Required: every hypothesis must say how to confirm it. */
  screeningTest: ScreeningTest,
});
export type RootCauseHypothesis = z.infer<typeof RootCauseHypothesis>;

export const CorrectiveType = z.enum(["mobility", "activation", "strengthening", "motor_control", "technique_cue", "regression"]);
export type CorrectiveType = z.infer<typeof CorrectiveType>;

/** Tier 3: a corrective for a hypothesis, with dosage. */
export const CorrectivePrescription = z.object({
  id: z.string().min(1),
  hypothesisId: z.string().min(1),
  type: CorrectiveType,
  name: z.string().min(1),
  /** Library exercise, when the corrective is one (so it can be added to a Program). */
  exerciseId: Slug.optional(),
  dosage: z
    .object({
      sets: z.number().int().positive().optional(),
      reps: z.number().int().positive().optional(),
      durationSec: z.number().positive().optional(),
      frequencyPerWeek: z.number().int().min(1).max(14).optional(),
      notes: z.string().optional(),
    })
    .default({}),
  cue: z.string().optional(),
});
export type CorrectivePrescription = z.infer<typeof CorrectivePrescription>;

export const DiagnosticReport = z.object({
  id: z.string().min(1),
  /** Analysis session id from packages/db, once persisted. */
  sessionId: z.string().optional(),
  exerciseId: Slug,
  cameraView: CameraView,
  createdAt: IsoDateTime,
  reps: z.array(RepSegment),
  findings: z.array(KinematicFinding),
  hypotheses: z.array(RootCauseHypothesis),
  prescriptions: z.array(CorrectivePrescription),
  /** Versions of the content/ rule sets used, for reproducibility. */
  rulesVersion: z.object({ tier1: z.string(), tier2: z.string(), tier3: z.string() }),
  disclaimers: z.array(z.string()).default([]),
}).superRefine((r, ctx) => {
  const findingIds = new Set(r.findings.map((f) => f.id));
  const hypothesisIds = new Set(r.hypotheses.map((h) => h.id));
  r.findings.forEach((f, i) => {
    if (f.requiredView !== r.cameraView) {
      ctx.addIssue({ code: "custom", path: ["findings", i, "requiredView"], message: `finding needs a ${f.requiredView} view but the clip is ${r.cameraView}` });
    }
  });
  r.hypotheses.forEach((h, i) => {
    h.findingIds.forEach((id, j) => {
      if (!findingIds.has(id)) ctx.addIssue({ code: "custom", path: ["hypotheses", i, "findingIds", j], message: `unknown finding ${id}` });
    });
  });
  r.prescriptions.forEach((p, i) => {
    if (!hypothesisIds.has(p.hypothesisId)) ctx.addIssue({ code: "custom", path: ["prescriptions", i, "hypothesisId"], message: `unknown hypothesis ${p.hypothesisId}` });
  });
});
export type DiagnosticReport = z.infer<typeof DiagnosticReport>;
