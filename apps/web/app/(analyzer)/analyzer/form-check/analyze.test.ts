import { describe, expect, it } from "vitest";
import { pulldown } from "@optimass/kinematics";
import { analyzePulldownSet } from "./analyze";

const clip = (variant: "good" | "shrug") =>
  pulldown.synthesizePulldown(pulldown.pulldownProfileFor("wide_overhand", variant), { camera: pulldown.pulldownCamera(135) });

describe("form check adapter: each rep vs the good rep", () => {
  it("scores a good rep high and flags the joint a fault changes", () => {
    const good = analyzePulldownSet(clip("good"), "wide_overhand", { side: "both" });
    expect(good.compare).toMatchObject({ personal: false });
    for (const r of good.reps) {
      expect(r.comparison!.off).toEqual([]);
      expect(r.comparison!.score).toBeGreaterThanOrEqual(90);
    }
    const shrug = analyzePulldownSet(clip("shrug"), "wide_overhand");
    const flagged = shrug.reps.flatMap((r) => r.comparison!.off.map((o) => o.joint));
    expect(flagged).toContain("scapular_elevation");
  });
});
