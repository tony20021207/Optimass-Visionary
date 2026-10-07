import type { Exercise, ExerciseRating, Program, ProgramGoal } from "@optimass/types";

export const MODULE = "M3" as const;

export interface ProgramRequest {
  name: string;
  goal: ProgramGoal;
  weeks: number;
  daysPerWeek: number;
  /** Muscle ids to prioritize; the rest get maintenance volume. */
  priorityMuscles: string[];
  /** Exercise ids the user can't or won't do. */
  excludedExercises?: string[];
}

const notImplemented = (fn: string): never => {
  throw new Error(`${fn} is not implemented yet (M3, see docs/specs/M3.md)`);
};

/** Builds a Program from a request, a library and its ratings. Volume landmarks come from content/, never code. */
export function buildProgram(_request: ProgramRequest, _library: readonly Exercise[], _ratings: readonly ExerciseRating[]): Program {
  return notImplemented("buildProgram");
}
