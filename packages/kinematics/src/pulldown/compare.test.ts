import { describe, expect, it } from "vitest";
import { calibrateSkeleton } from "../body";
import { POSTURE_VARIANTS, synthesizePostureScreen } from "../posture";
import {
  analyzePulldown,
  PULLDOWN_SETUPS,
  pulldownCamera,
  pulldownIdeal,
  pulldownProfileFor,
  synthesizePulldown,
  type PulldownCompareJoint,
  type PulldownCompareKey,
  type PulldownSetup,
  type PulldownVariant,
} from "./index";

const compare = (setup: PulldownSetup, variant: PulldownVariant, az = 135) =>
  analyzePulldown(synthesizePulldown(pulldownProfileFor(setup, variant), { camera: pulldownCamera(az) }), undefined, { compare: { setup } }).reps.map(
    (r) => r.comparison!,
  );

describe("comparing reps to the user's good rep (Top / ⅓ / ⅔ / Bottom)", () => {
  for (const setup of Object.keys(PULLDOWN_SETUPS) as PulldownSetup[]) {
    it(`${setup}: the good rep matches itself from either 45° rear view`, () => {
      for (const az of [135, 225]) {
        for (const c of compare(setup, "good", az)) {
          expect(c.off).toEqual([]);
          expect(c.score).toBeGreaterThanOrEqual(90);
          expect(c.keys.map((k) => k.key)).toEqual(["top", "third1", "third2", "bottom"]);
        }
      }
    });
  }

  // Each fault should show up at the joint and key it changes, in the right direction, with a lower score.
  const cases: [PulldownSetup, PulldownVariant, PulldownCompareKey, PulldownCompareJoint, 1 | -1][] = [
    ["wide_overhand", "momentum_swing", "bottom", "trunk_flexion", -1],
    ["wide_overhand", "partial_rom", "top", "elbow_flexion", 1],
    ["wide_overhand", "partial_rom", "bottom", "shoulder_elevation", 1],
    ["wide_overhand", "shrug", "bottom", "scapular_elevation", 1],
    ["wide_overhand", "over_pull", "bottom", "shoulder_plane_of_elevation", -1],
    ["wide_overhand", "scapular_protraction", "bottom", "scapular_protraction", 1],
    ["wide_overhand", "shoulder_internal_rotation", "bottom", "shoulder_rotation", -1],
    ["narrow_underhand", "early_elbow_flexion", "third1", "elbow_flexion", 1],
    ["neutral_bar", "elbows_forward", "third2", "shoulder_plane_of_elevation", 1],
    ["close_v_bar", "shrug", "bottom", "scapular_elevation", 1],
  ];
  for (const [setup, variant, key, joint, sign] of cases) {
    it(`${setup} ${variant}: flags ${joint} at ${key}`, () => {
      const good = compare(setup, "good")[0]!.score;
      for (const c of compare(setup, variant)) {
        const hit = c.off.find((o) => o.key === key && o.joint === joint);
        expect(hit, JSON.stringify(c.off)).toBeDefined();
        expect(Math.sign(hit!.diff)).toBe(sign);
        expect(c.score).toBeLessThan(good);
      }
    });
  }

  it("leaves joints it can't see unmeasured instead of guessing", () => {
    const top = compare("wide_overhand", "good")[0]!.keys[0]!;
    expect(top.joints.shoulder_rotation.status).toBe("unmeasured");
    expect(top.joints.elbow_flexion.status).toBe("ok");
  });

  it("uses the user's own baseline when one is passed", () => {
    const profile = pulldownProfileFor("wide_overhand", "partial_rom");
    const seq = synthesizePulldown(profile);
    const r = analyzePulldown(seq, undefined, { compare: { profile } });
    for (const rep of r.reps) expect(rep.comparison!.off).toEqual([]);
  });

  it("runs the good rep on the user's posture-check skeleton", () => {
    const skeleton = calibrateSkeleton(synthesizePostureScreen(POSTURE_VARIANTS.neutral));
    const ideal = pulldownIdeal({ setup: "wide_overhand", skeleton });
    expect(ideal.keys).toHaveLength(4);
    const r = analyzePulldown(synthesizePulldown(pulldownProfileFor("wide_overhand", "good")), undefined, { skeleton, compare: { setup: "wide_overhand" } });
    for (const rep of r.reps) {
      expect(rep.comparison!.off).toEqual([]);
      expect(rep.comparison!.score).toBeGreaterThanOrEqual(90);
    }
  });

  it("can read just the filmed side", () => {
    const seq = synthesizePulldown(pulldownProfileFor("wide_overhand", "good"), { camera: pulldownCamera(135) });
    const r = analyzePulldown(seq, undefined, { compare: { setup: "wide_overhand", side: "left" } });
    for (const rep of r.reps) expect(rep.comparison!.off).toEqual([]);
  });
});
