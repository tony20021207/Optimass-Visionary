import { z } from "zod";
import { Slug } from "@optimass/types";

const Cues = z.array(z.string().min(1)).default([]);
const Rating = z.number().int().min(1).max(10);

/** Shape of content/rules/coaching/<exercise>.yaml. Muscles, thresholds and cues are authored by Tony. */
/**
 * Phases the lifter reviews a rep in, in order. `endsAt` is where each phase ends, as a share (0-1] of the
 * working stroke's duration (for the pulldown, the pull down). The return passes through the same phases
 * in reverse. The last phase must end at 1.
 */
const Phases = z
  .array(z.object({ id: Slug, label: z.string().min(1), endsAt: z.number().gt(0).max(1) }))
  .min(1)
  .superRefine((phases, ctx) => {
    phases.forEach((p, i) => {
      if (i > 0 && p.endsAt <= phases[i - 1]!.endsAt) ctx.addIssue({ code: "custom", message: `phase ${p.id} must end after the one before it` });
    });
    if (phases.at(-1)!.endsAt !== 1) ctx.addIssue({ code: "custom", message: "the last phase must end at 1" });
    if (new Set(phases.map((p) => p.id)).size !== phases.length) ctx.addIssue({ code: "custom", message: "phase ids must be unique" });
  });

export type CoachingPhase = z.infer<typeof Phases>[number];

export const CoachingTable = z.object({
  version: z.string().min(1),
  exerciseId: Slug,
  phases: Phases,
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

const MuscleMark = z.object({
  rating: Rating,
  /** Where they tapped on the video, and when. */
  timeSec: z.number().nonnegative(),
  point: FramePoint.optional(),
});

/**
 * What the lifter tells us after a set. They review one rep (the one closest to good form) a phase at a time,
 * marking muscles they felt working and then any discomfort in each phase.
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
        /** Keyed by the phase ids in the coaching file. */
        byPhase: z.record(Slug, MuscleMark).optional(),
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
        /** Phase id from the coaching file. */
        phase: Slug.optional(),
        areaId: Slug.optional(),
        note: z.string().default(""),
      }),
    )
    .default([]),
});
export type SetFeedback = z.input<typeof SetFeedback>;
