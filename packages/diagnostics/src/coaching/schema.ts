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

/**
 * Thirds of the pull's range of motion: top to 1/3, 1/3 to 2/3, 2/3 to bottom. Same boundaries as Tier 1's
 * keyframes (top, 1/3, 2/3, bottom). Each third covers the pull through it and the return through it.
 */
export const RomPhase = z.enum(["first_third", "middle_third", "last_third"]);
export type RomPhase = z.infer<typeof RomPhase>;

const MuscleMark = z.object({
  rating: Rating,
  /** Where they tapped on the video, and when. */
  timeSec: z.number().nonnegative(),
  point: FramePoint.optional(),
});

/**
 * What the lifter tells us after a set. They review one rep (the one closest to good form) a third at a time,
 * marking muscles they felt working and then any discomfort in each third.
 */
export const SetFeedback = z.object({
  /** The rep the lifter reviewed (the one closest to good form), in seconds into the set video. */
  rep: z.object({ repIndex: z.number().int().nonnegative(), startSec: z.number().nonnegative(), endSec: z.number().nonnegative() }).optional(),
  muscles: z
    .record(
      Slug,
      z.object({
        felt: z.boolean(),
        /** Strongest rating across the phases. */
        rating: Rating.optional(),
        byPhase: z.partialRecord(RomPhase, MuscleMark).optional(),
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
        phase: RomPhase.optional(),
        areaId: Slug.optional(),
        note: z.string().default(""),
      }),
    )
    .default([]),
});
export type SetFeedback = z.input<typeof SetFeedback>;
