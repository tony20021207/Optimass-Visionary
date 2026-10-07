import { z } from "zod";

/** Kebab/snake-case slug used for every domain id (muscles, exercises, rules, tests). */
export const Slug = z.string().regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, "expected a lowercase slug");
export type Slug = z.infer<typeof Slug>;

export const IsoDateTime = z.iso.datetime({ offset: true });

/** 0..1 inclusive. */
export const UnitInterval = z.number().min(0).max(1);

export const Side = z.enum(["left", "right", "bilateral"]);
export type Side = z.infer<typeof Side>;

export const Plane = z.enum(["sagittal", "frontal", "transverse"]);
export type Plane = z.infer<typeof Plane>;

/** Camera placement relative to the lifter. A sagittal view films from the side, frontal from the front or back. */
export const CameraView = z.enum(["sagittal", "frontal"]);
export type CameraView = z.infer<typeof CameraView>;

export const NumericRange = z
  .object({ min: z.number(), max: z.number() })
  .refine((r) => r.min <= r.max, "min must be <= max");
export type NumericRange = z.infer<typeof NumericRange>;
