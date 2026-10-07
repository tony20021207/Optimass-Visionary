import { z } from "zod";
import { CameraView, Slug, UnitInterval } from "./common";
import { JointId } from "./anatomy";

export const Equipment = z.enum(["barbell", "dumbbell", "cable", "machine", "smith_machine", "bodyweight", "band", "kettlebell", "other"]);
export type Equipment = z.infer<typeof Equipment>;

export const MovementPattern = z.enum([
  "squat",
  "hinge",
  "lunge",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "elbow_flexion",
  "elbow_extension",
  "knee_flexion",
  "knee_extension",
  "hip_abduction",
  "hip_adduction",
  "plantarflexion",
  "fly",
  "raise",
  "trunk",
  "carry",
  "other",
]);
export type MovementPattern = z.infer<typeof MovementPattern>;

/** Where along the target muscle's length the external torque peaks. */
export const ResistanceProfile = z.enum(["lengthened", "mid_range", "shortened", "flat"]);
export type ResistanceProfile = z.infer<typeof ResistanceProfile>;

/** How much external support the lifter has (more support → less stability demand). */
export const StabilityLevel = z.enum(["fully_supported", "partially_supported", "free_standing"]);
export type StabilityLevel = z.infer<typeof StabilityLevel>;

export const Exercise = z.object({
  id: Slug,
  name: z.string().min(1),
  equipment: Equipment,
  pattern: MovementPattern,
  laterality: z.enum(["bilateral", "unilateral"]),
  primaryMuscles: z.array(Slug).min(1),
  secondaryMuscles: z.array(Slug).default([]),
  joints: z.array(JointId).min(1),
  resistanceProfile: ResistanceProfile,
  stability: StabilityLevel,
  /** Camera views the analyzer supports for this lift. Empty means not analyzable. */
  analyzableViews: z.array(CameraView).default([]),
  /** True for correctives (mobility/activation drills) so the planner can filter them. */
  isCorrective: z.boolean().default(false),
});
export type Exercise = z.infer<typeof Exercise>;

/** One criterion's contribution to a rating. Criteria and weights are authored in content/rating. */
export const RatingCriterionScore = z.object({
  criterionId: Slug,
  /** Normalized score for this criterion. */
  score: UnitInterval,
  weight: z.number().nonnegative(),
  rationale: z.string().optional(),
});
export type RatingCriterionScore = z.infer<typeof RatingCriterionScore>;

export const ExerciseRating = z.object({
  exerciseId: Slug,
  targetMuscleId: Slug,
  criteria: z.array(RatingCriterionScore).min(1),
  /** Weighted total, 0..100. */
  total: z.number().min(0).max(100),
  /** Version of the rubric in content/rating that produced this rating. */
  rubricVersion: z.string().min(1),
});
export type ExerciseRating = z.infer<typeof ExerciseRating>;
