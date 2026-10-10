import { z } from "zod";
import { Slug } from "@optimass/types";

const Cues = z.array(z.string().min(1)).default([]);
const Rating = z.number().int().min(1).max(10);

/** Shape of content/rules/coaching/<exercise>.yaml. Muscles, thresholds and cues are authored by Tony. */
export const CoachingTable = z.object({
  version: z.string().min(1),
  exerciseId: Slug,
  feel: z.object({
    lowRating: Rating,
    highRating: Rating,
    muscles: z
      .array(
        z.object({
          id: Slug,
          label: z.string().min(1),
          where: z.string().min(1),
          role: z.enum(["target", "watch"]),
          /** Which drawn area of the body map lights up for this muscle (see the set session UI). */
          region: z.enum(["lats", "rhomboids", "rear_delts", "arms", "upper_traps"]).optional(),
          lowCues: Cues,
          highCues: Cues,
        }),
      )
      .min(1),
  }),
  discomfort: z.object({
    safetyNote: z.string().min(1),
    areas: z.array(z.object({ id: Slug, label: z.string().min(1), cues: Cues })).min(1),
  }),
  formCues: z.record(Slug, Cues).default({}),
  causeCues: z.record(Slug, Cues).default({}),
});
export type CoachingTable = z.infer<typeof CoachingTable>;

/** What the lifter tells us after a set (questions 1-3). */
export const SetFeedback = z.object({
  muscles: z.record(Slug, z.object({ felt: z.boolean(), rating: Rating.optional() })).default({}),
  discomfort: z
    .array(
      z.object({
        id: z.string().min(1),
        /** Seconds into the set video. */
        timeSec: z.number().nonnegative(),
        /** Where on the paused frame the lifter pointed, as 0..1 fractions of width and height. */
        point: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
        areaId: Slug.optional(),
        note: z.string().default(""),
      }),
    )
    .default([]),
});
export type SetFeedback = z.input<typeof SetFeedback>;
