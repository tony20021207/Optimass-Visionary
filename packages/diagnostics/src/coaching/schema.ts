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

/** Where on a paused frame the lifter pointed, as 0..1 fractions of the video frame's width and height. */
const FramePoint = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

/** What the lifter tells us after a set: muscles they felt working, then any discomfort, both marked on one rep. */
export const SetFeedback = z.object({
  /** The rep the lifter reviewed (the one closest to good form), in seconds into the set video. */
  rep: z.object({ repIndex: z.number().int().nonnegative(), startSec: z.number().nonnegative(), endSec: z.number().nonnegative() }).optional(),
  muscles: z
    .record(
      Slug,
      z.object({
        felt: z.boolean(),
        rating: Rating.optional(),
        /** Where they tapped on the video for this muscle, and when. */
        timeSec: z.number().nonnegative().optional(),
        point: FramePoint.optional(),
      }),
    )
    .default({}),
  discomfort: z
    .array(
      z.object({
        id: z.string().min(1),
        /** Seconds into the set video. */
        timeSec: z.number().nonnegative(),
        point: FramePoint.optional(),
        areaId: Slug.optional(),
        note: z.string().default(""),
      }),
    )
    .default([]),
});
export type SetFeedback = z.input<typeof SetFeedback>;
