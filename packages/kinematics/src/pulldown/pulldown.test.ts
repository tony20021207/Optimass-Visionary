import { POSE_LANDMARK_NAMES, RepSegment } from "@optimass/types";
import { describe, expect, it } from "vitest";
import { analyzeKinematics } from "../index";
import {
  DEFAULT_PULLDOWN_PARAMS,
  GOOD_PULLDOWN,
  PULLDOWN_WAIST_HEIGHT_M,
  PULLDOWN_VARIANTS,
  analyzePulldown,
  barTravelFor,
  parsePulldownParams,
  poseAt,
  PULLDOWN_SETUPS,
  PULLDOWN_SYNTH_ARMS,
  recommendedGrip,
  pulldownProfileFor,
  type PulldownSetup,
  pulldownSeries,
  segmentLength,
  synthesizePulldown,
  type PulldownVariant,
} from "./index";

/** Camera azimuths: 135 = the standard 45° behind-left view, 0 = front, 90 = left side, 225 = behind-right. */
const AZIMUTHS = [135, 225, 0, 90] as const;
const at = (azimuthDeg: number) => ({ azimuthDeg, heightM: PULLDOWN_WAIST_HEIGHT_M, distanceM: 3 });
const clip = (variant: PulldownVariant, azimuthDeg = 135) => synthesizePulldown(PULLDOWN_VARIANTS[variant], { camera: at(azimuthDeg) });

describe("synthetic pulldown clips", () => {
  it("bend the elbows out to the side at the top, not straight back (Tony, 2026-10-09)", () => {
    const b = poseAt(0, { ...GOOD_PULLDOWN, noiseM: 0 });
    const s = b.left_shoulder;
    const e = b.left_elbow;
    const w = b.left_wrist;
    const sw = [w.x - s.x, w.y - s.y, w.z - s.z];
    const n = Math.hypot(...sw);
    const u = sw.map((c) => c / n);
    const se = [e.x - s.x, e.y - s.y, e.z - s.z];
    const along = se[0]! * u[0]! + se[1]! * u[1]! + se[2]! * u[2]!;
    const [outward, , back] = se.map((c, i) => c - along * u[i]!);
    expect(outward!).toBeGreaterThan(0.005);
    expect(Math.abs(back!)).toBeLessThan(outward!);
  });

  it("keep segment lengths constant (a rigid stick figure)", () => {
    const seq = synthesizePulldown({ ...GOOD_PULLDOWN, noiseM: 0 });
    for (const f of [0, 40, 80]) {
      expect(segmentLength(seq, f, "left_shoulder", "left_elbow")).toBeCloseTo(0.3, 3);
      expect(segmentLength(seq, f, "left_elbow", "left_wrist")).toBeCloseTo(0.27, 3);
    }
  });

  it("give the same 3D angles from any camera position", () => {
    const quiet = { ...GOOD_PULLDOWN, noiseM: 0 };
    const reference = pulldownSeries(synthesizePulldown(quiet, { camera: at(135) })).metrics;
    for (const az of AZIMUTHS) {
      const other = pulldownSeries(synthesizePulldown(quiet, { camera: at(az) })).metrics;
      for (const name of ["left_elbow_flexion_deg", "right_humerothoracic_elevation_deg", "trunk_lean_deg", "wrist_mid_height_m"]) {
        reference[name]!.forEach((x, i) => expect(other[name]![i]).toBeCloseTo(x, 1));
      }
    }
  });

  it("use the standard 45° behind-left camera by default, with the far side less visible", () => {
    const seq = synthesizePulldown(GOOD_PULLDOWN);
    const f = seq.frames[0]!;
    const vis = (name: string) => f.worldLandmarks[POSE_LANDMARK_NAMES.indexOf(name as never)]!.visibility;
    expect(vis("left_shoulder")).toBeGreaterThan(vis("right_shoulder"));
    expect(vis("nose")).toBeLessThan(0.5); // filmed from behind
    for (const lm of f.landmarks) {
      expect(lm.x).toBeGreaterThan(0);
      expect(lm.x).toBeLessThan(1);
      expect(lm.y).toBeGreaterThan(0);
      expect(lm.y).toBeLessThan(1);
    }
  });
});

describe("pulldown kinematics", () => {
  it("analyzeKinematics finds every rep and each one parses as a RepSegment", () => {
    const { reps, series } = analyzeKinematics(clip("good"));
    expect(reps).toHaveLength(GOOD_PULLDOWN.reps);
    for (const rep of reps) expect(() => RepSegment.parse(rep)).not.toThrow();
    expect(Object.keys(series.metrics)).toContain("left_elbow_flexion_vel_dps");
    expect(Object.keys(series.metrics)).toContain("left_wrist_speed_mps");
  });

  it("finds no reps when the bar does not move", () => {
    const still = synthesizePulldown({ ...GOOD_PULLDOWN, reps: 0 });
    expect(analyzeKinematics(still).reps).toHaveLength(0);
  });

  it("elbow flexion peaks while the bar is near the bottom", () => {
    const { series, reps } = analyzePulldown(clip("good"));
    const elbow = series.metrics.left_elbow_flexion_deg!;
    const height = series.metrics.wrist_mid_height_m!;
    const lo = Math.min(...height);
    const travel = Math.max(...height) - lo;
    for (const { rep } of reps) {
      let peak = rep.startFrame;
      for (let i = rep.startFrame; i <= rep.endFrame; i++) if (elbow[i]! > elbow[peak]!) peak = i;
      // Not exactly at the bottom: once the wrists pass below the shoulders, the hand-to-shoulder distance grows
      // again and the elbow opens slightly. So "near the bottom" = lowest 20% of bar travel.
      expect((height[peak]! - lo) / travel).toBeLessThan(0.2);
    }
  });
});

describe("placeholder parameters vs synthetic reps", () => {
  const failedFaults = (variant: PulldownVariant) => {
    const { reps } = analyzePulldown(clip(variant));
    return new Set(reps.flatMap((r) => r.checks.filter((c) => c.status === "fail").map((c) => c.fault)));
  };

  it("the good rep passes every check, from any camera position", () => {
    for (const az of AZIMUTHS) {
      const { reps } = analyzePulldown(clip("good", az));
      for (const r of reps) expect(r.checks.filter((c) => c.status === "fail")).toEqual([]);
    }
  });

  // Fault codes match the Tier 1 error codes in content/rules/tier2/lat_pulldown.yaml where one exists.
  it.each([
    ["momentum_swing", ["excessive_torso_lean"]],
    ["partial_rom", ["incomplete_top_rom", "incomplete_bottom_rom"]],
    ["shrug", ["shoulder_elevation"]],
    ["fast_eccentric", ["fast_eccentric"]],
    // Rotating the whole arm back swings the elbows in behind the hands, so the forearms leave the line of pull too.
    ["over_pull", ["excessive_shoulder_extension", "forearm_off_line"]],
    // Close grip, elbows in front: the forearm cannot stay on the line of pull.
    ["elbows_forward", ["forearm_off_line"]],
    ["asymmetric", ["asymmetric_pull"]],
    ["forward_head", ["forward_head"]],
  ] as const)("%s trips only its own checks: %j", (variant, faults) => {
    expect([...failedFaults(variant)].sort()).toEqual([...faults].sort());
  });

  it("splits the pull into shoulder extension vs adduction from every camera angle", () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    for (const az of AZIMUTHS) {
      const wide = analyzePulldown(clip("good", az)).reps.map((r) => r.features);
      const fwd = analyzePulldown(clip("elbows_forward", az)).reps;
      const f = fwd.map((r) => r.features);
      // Wide grip, elbows out: mostly adduction. Elbows forward: mostly extension.
      expect(mean(wide.map((x) => x.extension_share))).toBeLessThan(0.35);
      expect(mean(f.map((x) => x.extension_share))).toBeGreaterThan(0.75);
      expect(mean(wide.map((x) => x.plane_of_elevation_mid_deg))).toBeLessThan(30);
      expect(mean(f.map((x) => x.plane_of_elevation_mid_deg))).toBeGreaterThan(60);
      // Both pulls cover a full arm arc (~95-165 deg); only the split changes.
      for (const x of [...wide, ...f]) expect(x.shoulder_extension_deg + x.shoulder_adduction_deg).toBeGreaterThan(80);
    }
  });

  it("recovers the pull line and forearm alignment from every camera angle", () => {
    for (const az of AZIMUTHS) {
      for (const r of analyzePulldown(clip("good", az)).reps) {
        expect(Math.abs(r.features.pull_line_deg - PULLDOWN_VARIANTS.good.pullLineDeg)).toBeLessThan(2);
        expect(r.features.forearm_off_line_deg).toBeLessThan(5);
        expect(Math.abs(r.features.forearm_off_line_bottom_deg - barTravelFor(PULLDOWN_VARIANTS.good).breakDeg)).toBeLessThan(4);
        // Arms finish where the profile asks (adduction target).
        expect(Math.abs(r.features.humerothoracic_elevation_bottom_deg - PULLDOWN_VARIANTS.good.bottomArmElevationDeg)).toBeLessThan(5);
      }
    }
  });

  it("follows a profile edited in place (Motion Lab sliders)", () => {
    const profile = { ...PULLDOWN_VARIANTS.good };
    const before = barTravelFor(profile).bottom;
    profile.bottomHumerusBehindDeg = 25;
    expect(barTravelFor(profile).bottom).not.toBeCloseTo(before, 3);
  });

  it("rejects malformed parameter files", () => {
    expect(() => parsePulldownParams({ exerciseId: "lat_pulldown", checks: [{ id: "x", feature: "nope" }] })).toThrow(/unknown feature/);
    expect(() =>
      parsePulldownParams({ exerciseId: "lat_pulldown", checks: [{ id: "x", feature: "eccentric_s", min: 3, max: 1 }] }),
    ).toThrow(/min > max/);
    expect(DEFAULT_PULLDOWN_PARAMS.checks.every((c) => c.placeholder)).toBe(true);
  });
});

describe("pulldown variations", () => {
  it.each(Object.keys(PULLDOWN_SETUPS) as PulldownSetup[])("%s: the good rep segments into 3 reps that reach the chest", (setup) => {
    const report = analyzePulldown(synthesizePulldown(pulldownProfileFor(setup), { camera: at(135) }));
    expect(report.reps).toHaveLength(3);
    for (const r of report.reps) expect(Math.abs(r.features.bar_bottom_rel_shoulder_m!)).toBeLessThan(0.12);
  });

  it("close grips pull with more shoulder extension than the wide overhand grip", () => {
    const share = (setup: PulldownSetup) => {
      const reps = analyzePulldown(synthesizePulldown(pulldownProfileFor(setup), { camera: at(135) })).reps;
      return reps.reduce((s, r) => s + r.features.extension_share!, 0) / reps.length;
    };
    expect(share("narrow_underhand")).toBeGreaterThan(share("wide_overhand") + 0.4);
    expect(share("v_handle")).toBeGreaterThan(share("wide_overhand") + 0.4);
  });

  it("puts a fault on top of a variation and keeps the variation's grip", () => {
    const p = pulldownProfileFor("narrow_underhand", "fast_eccentric");
    expect(p.gripType).toBe("underhand");
    expect(p.gripWidthXShoulder).toBe(1.0);
    expect(p.eccentricS).toBe(PULLDOWN_VARIANTS.fast_eccentric.eccentricS);
  });
});

describe("grip from arm lengths", () => {
  it("by default puts the hands under the middle of the elbow's swing: Tony's 2.2x on the synthetic lifter", () => {
    expect(recommendedGrip(PULLDOWN_SYNTH_ARMS).gripWidthXShoulder).toBeCloseTo(2.2, 1);
  });

  it("bottom-only rule: forearms vertical at the bottom (synthetic lifter: 2.0x)", () => {
    const g = recommendedGrip(PULLDOWN_SYNTH_ARMS, { bottomArmElevationDeg: 42, forearmTiltDeg: 0 });
    expect(g.gripWidthXShoulder).toBeCloseTo(2.0, 1);
    // The formula's bar height matches the synthetic rep at that grip and arm angle.
    const reps = analyzePulldown(synthesizePulldown({ ...GOOD_PULLDOWN, gripWidthXShoulder: g.gripWidthXShoulder, noiseM: 0 }), undefined, {}).reps;
    const bar = reps.reduce((s, r) => s + r.features.bar_bottom_rel_shoulder_m!, 0) / reps.length;
    expect(Math.abs(bar - g.barAboveShouldersM)).toBeLessThan(0.02);
  });

  it("widens the grip for a longer upper arm at the same shoulder width", () => {
    const base = recommendedGrip(PULLDOWN_SYNTH_ARMS).gripWidthM;
    const longArms = recommendedGrip({ ...PULLDOWN_SYNTH_ARMS, upperArmM: 0.34 }).gripWidthM;
    expect(longArms - base).toBeCloseTo(0.04 * (Math.sin((42 * Math.PI) / 180) + 0.93), 6);
  });
});
