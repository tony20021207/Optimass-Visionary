import { z } from "zod";
import { IsoDateTime, NumericRange, Slug } from "./common";

export const ProgramGoal = z.enum(["hypertrophy", "strength_hypertrophy", "maintenance", "rehab_return"]);
export type ProgramGoal = z.infer<typeof ProgramGoal>;

export const PrescribedExercise = z.object({
  exerciseId: Slug,
  order: z.number().int().nonnegative(),
  sets: z.number().int().positive(),
  repRange: NumericRange,
  /** Target reps in reserve. */
  rir: z.number().min(0).max(10).optional(),
  restSeconds: z.number().int().positive().optional(),
  /** Tempo as eccentric-pause-concentric-pause seconds, e.g. "3-1-1-0". */
  tempo: z.string().regex(/^\d+-\d+-\d+-\d+$/).optional(),
  /** Set when the exercise was added from a DiagnosticReport (M10). */
  sourcePrescriptionId: z.string().optional(),
  notes: z.string().optional(),
});
export type PrescribedExercise = z.infer<typeof PrescribedExercise>;

export const ProgramSession = z.object({
  /** 0-based day within the microcycle. */
  dayIndex: z.number().int().nonnegative(),
  name: z.string().min(1),
  exercises: z.array(PrescribedExercise),
});
export type ProgramSession = z.infer<typeof ProgramSession>;

export const ProgressionModel = z.object({
  type: z.enum(["double_progression", "rir_based", "load_linear", "custom"]),
  notes: z.string().optional(),
});
export type ProgressionModel = z.infer<typeof ProgressionModel>;

export const Program = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  goal: ProgramGoal,
  /** Mesocycle length in weeks. */
  weeks: z.number().int().positive(),
  daysPerWeek: z.number().int().min(1).max(7),
  split: z.string().min(1),
  /** One microcycle (week) template; progression is applied across weeks. */
  sessions: z.array(ProgramSession).min(1),
  /** Planned hard sets per week per muscle id. */
  weeklySetsPerMuscle: z.record(Slug, z.number().nonnegative()),
  progression: ProgressionModel,
  deloadWeek: z.number().int().positive().optional(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type Program = z.infer<typeof Program>;
