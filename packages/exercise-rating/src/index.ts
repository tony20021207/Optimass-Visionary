import type { AnatomyKb } from "@optimass/anatomy-kb";
import type { Exercise, ExerciseRating } from "@optimass/types";

export const MODULE = "M2" as const;

/** Rubric loaded from content/rating: criteria ids, weights and scoring tables. */
export interface RatingRubric {
  version: string;
  criteria: ReadonlyArray<{ id: string; weight: number }>;
}

const notImplemented = (fn: string): never => {
  throw new Error(`${fn} is not implemented yet (M2, see docs/specs/M2.md)`);
};

export function loadRubric(_contentDir: string): RatingRubric {
  return notImplemented("loadRubric");
}

/** Rates `exercise` for `targetMuscleId` against the rubric. */
export function rateExercise(_exercise: Exercise, _targetMuscleId: string, _rubric: RatingRubric, _kb: AnatomyKb): ExerciseRating {
  return notImplemented("rateExercise");
}
