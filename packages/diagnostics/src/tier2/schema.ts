import { z } from "zod";
import { CameraView, JointId, RootCauseCategory, ScreeningTest, Severity, Slug, UnitInterval } from "@optimass/types";

/** Shape of one content/rules/tier2/<exercise>.yaml file. Values are authored by Tony; the engine never invents them. */
export const Tier2Pattern = z.object({
  /** Every error code listed must be present among the clip's findings for the pattern to match. */
  all: z.array(Slug).min(1),
  weight: UnitInterval,
});
export type Tier2Pattern = z.infer<typeof Tier2Pattern>;

export const Tier2Cause = z.object({
  id: Slug,
  category: RootCauseCategory,
  label: z.string().min(1),
  structures: z.object({
    muscles: z.array(Slug).default([]),
    joints: z.array(JointId).default([]),
  }),
  /** Key into the file's `screeningTests`. */
  screeningTest: Slug,
  baseline: UnitInterval.default(0),
  patterns: z.array(Tier2Pattern).min(1),
});
export type Tier2Cause = z.infer<typeof Tier2Cause>;

export const Tier2Table = z
  .object({
    version: z.string().min(1),
    exerciseId: Slug,
    severityMultiplier: z.record(Severity, UnitInterval),
    errorCodes: z.record(Slug, z.object({ label: z.string().min(1), view: CameraView })),
    screeningTests: z.record(Slug, ScreeningTest.omit({ id: true })),
    causes: z.array(Tier2Cause).min(1),
  })
  .superRefine((t, ctx) => {
    const seen = new Set<string>();
    t.causes.forEach((c, i) => {
      if (seen.has(c.id)) ctx.addIssue({ code: "custom", path: ["causes", i, "id"], message: `duplicate cause ${c.id}` });
      seen.add(c.id);
      if (!(c.screeningTest in t.screeningTests)) {
        ctx.addIssue({ code: "custom", path: ["causes", i, "screeningTest"], message: `unknown screening test ${c.screeningTest}` });
      }
      c.patterns.forEach((p, j) =>
        p.all.forEach((code, k) => {
          if (!(code in t.errorCodes)) {
            ctx.addIssue({ code: "custom", path: ["causes", i, "patterns", j, "all", k], message: `unknown error code ${code}` });
          }
        }),
      );
    });
  });
export type Tier2Table = z.infer<typeof Tier2Table>;
