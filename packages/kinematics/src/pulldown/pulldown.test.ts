import { POSE_LANDMARK_NAMES, RepSegment } from "@optimass/types";
import { describe, expect, it } from "vitest";
import { analyzeKinematics } from "../index";
import { calibrateSkeleton } from "../body";
import { POSTURE_VARIANTS, synthesizePostureScreen } from "../posture";
import { JOINT_END_RANGES, JOINT_MOTIONS, jointLimits } from "../joints";
import {
  DEFAULT_PULLDOWN_PARAMS,
  DEFAULT_PULLDOWN_PACING,
  evaluatePulldownRep,
  elbowFlexionHoldingForearm,
  jointsAt,
  planeForShoulderRotation,
  pulldownArmOnBar,
  PULLDOWN_JOINT_NAMES,
  PULLDOWN_KEY_AT,
  pulldownForearmToCableDeg,
  GOOD_PULLDOWN,
  pulldownCamera,
  PULLDOWN_VARIANTS,
  analyzePulldown,
  parsePulldownParams,
  pulldownParamsFor,
  poseAt,
  pullLineDegOf,
  PULLDOWN_SETUPS,
  PULLDOWN_SYNTH_ARMS,
  recommendedGrip,
  pulldownProfileFor,
  pulldownBodyFromSkeleton,
  PULLDOWN_SYNTH_BODY,
  type PulldownSetup,
  pulldownSeries,
  segmentLength,
  synthesizePulldown,
  type PulldownVariant,
} from "./index";

/** Camera azimuths: 135 = the standard 45° behind-left view, 0 = front, 90 = left side, 225 = behind-right. */
const AZIMUTHS = [135, 225, 0, 90] as const;
const at = (azimuthDeg: number) => pulldownCamera(azimuthDeg);
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
    ["momentum_swing", ["excessive_torso_lean", "yanking"]],
    ["partial_rom", ["incomplete_top_rom", "incomplete_bottom_rom"]],
    ["shrug", ["shoulder_elevation"]],
    ["fast_eccentric", ["fast_eccentric"]],
    // Rotating the whole arm back swings the elbows in behind the hands, so the forearms leave the line of pull too.
    ["over_pull", ["excessive_shoulder_extension", "forearm_off_line"]],
    // Close grip, elbows in front: the forearm cannot stay on the line of pull.
    ["elbows_forward", ["forearm_off_line"]],
    ["asymmetric", ["asymmetric_pull"]],
    ["forward_head", ["forward_head"]],
    ["yank", ["yanking"]],
    // Slowing mid-pull, then speeding up again to finish in time: a sticking point, and the re-acceleration reads as a yank.
    ["sticking_point", ["uneven_pacing", "yanking"]],
    ["inconsistent_tempo", ["inconsistent_tempo"]],
  ] as const)("%s trips only its own checks: %j", (variant, faults) => {
    expect([...failedFaults(variant)].sort()).toEqual([...faults].sort());
  });

  it("splits the pull into shoulder extension vs adduction from every camera angle", () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    for (const az of AZIMUTHS) {
      const wide = analyzePulldown(clip("good", az)).reps.map((r) => r.features);
      const fwd = analyzePulldown(clip("elbows_forward", az)).reps;
      const f = fwd.map((r) => r.features);
      // Wide grip, elbows out: mostly adduction. Elbows forward: mostly extension. (About 0.36 since the keyframes
      // became time thirds: four keys can't hold the old mid-pull abduction peak without a yank.)
      expect(mean(wide.map((x) => x.extension_share))).toBeLessThan(0.4);
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
        expect(Math.abs(r.features.pull_line_deg - pullLineDegOf(PULLDOWN_VARIANTS.good))).toBeLessThan(2);
        expect(r.features.forearm_off_line_deg).toBeLessThan(5);
        // Tony's baseline (2026-10-09): ~1° forearm break, arms 42° from the trunk at the bottom.
        expect(Math.abs(r.features.forearm_off_line_bottom_deg - 0.92)).toBeLessThan(4);
        expect(Math.abs(r.features.humerothoracic_elevation_bottom_deg - 42)).toBeLessThan(5);
      }
    }
  });

  it("follows a profile edited in place (Motion Lab sliders)", () => {
    const profile = { ...PULLDOWN_VARIANTS.good, joints: { ...PULLDOWN_VARIANTS.good.joints } };
    const before = poseAt(1, profile).left_wrist.y;
    profile.joints.shoulder_elevation = profile.joints.shoulder_elevation.map((x, i) => (i === 3 ? x + 20 : x));
    expect(poseAt(1, profile).left_wrist.y).not.toBeCloseTo(before, 3);
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
  it.each(Object.keys(PULLDOWN_SETUPS) as PulldownSetup[])("%s: the good rep segments into 3 reps and finishes near shoulder height", (setup) => {
    const report = analyzePulldown(synthesizePulldown(pulldownProfileFor(setup), { camera: at(135) }));
    expect(report.reps).toHaveLength(3);
    // Close grips stop short of the chest to keep the forearm on the cable (Tony, 2026-10-09).
    for (const r of report.reps) expect(Math.abs(r.features.bar_bottom_rel_shoulder_m!)).toBeLessThan(setup === "wide_overhand" ? 0.12 : 0.25);
  });

  it("close grips pull with more shoulder extension than the wide overhand grip", () => {
    const share = (setup: PulldownSetup) => {
      const reps = analyzePulldown(synthesizePulldown(pulldownProfileFor(setup), { camera: at(135) })).reps;
      return reps.reduce((s, r) => s + r.features.extension_share!, 0) / reps.length;
    };
    expect(share("narrow_underhand")).toBeGreaterThan(share("wide_overhand") + 0.4);
  });

  it("shoulder elevation keyframes bring the arms down on any grip", () => {
    const elevation = (elevationDeg: number) => {
      const p = pulldownProfileFor("neutral_bar");
      const joints = { ...p.joints, shoulder_elevation: p.joints.shoulder_elevation.map((x, i) => (i === 3 ? elevationDeg : x)) };
      const reps = analyzePulldown(synthesizePulldown({ ...p, joints, noiseM: 0 })).reps;
      return reps.reduce((s, r) => s + r.features.humerothoracic_elevation_bottom_deg!, 0) / reps.length;
    };
    expect(elevation(40) - elevation(5)).toBeGreaterThan(10);
  });

  it("keeps both hands on the bar at the grip width, with the bar setting shoulder rotation", () => {
    for (const setup of Object.keys(PULLDOWN_SETUPS) as PulldownSetup[]) {
      const p = { ...pulldownProfileFor(setup), noiseM: 0 };
      for (let prog = 0; prog <= 1.0001; prog += 0.05) {
        const b = poseAt(prog, p);
        const shoulderWidth = Math.abs(b.left_shoulder.x - b.right_shoulder.x);
        expect(Math.abs(b.left_wrist.x - b.right_wrist.x) / 0.4).toBeCloseTo(p.gripWidthXShoulder, 2);
        expect(shoulderWidth).toBeGreaterThan(0);
      }
    }
  });

  // Tony's narrow underhand baseline (2026-10-10, 16:45Z) breaks the forearm off the cable over the last 15% of the pull
  // (elbows swing out, plane 72.5° → 21.5°): ~20° side and front at 90% of the pull. Open question to Tony whether that
  // break is allowed for close grips, so only the neutral bar is held to the bottom-80% rule here.
  it.each(["neutral_bar"] as const)(
    "%s keeps the forearm within 15° of the cable, side and front, over the bottom 80% (Tony, 2026-10-09)",
    (setup) => {
      const p = { ...pulldownProfileFor(setup), noiseM: 0 };
      const deg = (r: number) => (r * 180) / Math.PI;
      const pulley = { y: p.pulleyAboveHipM, z: 0.43 + p.pulleyAheadOfKneeM };
      for (let prog = 0.2; prog <= 1.0001; prog += 0.1) {
        const b = poseAt(prog, p);
        const w = b.left_wrist;
        const e = b.left_elbow;
        expect(e.y).toBeLessThan(w.y);
        const side = deg(Math.atan2(w.z - e.z, w.y - e.y)) - deg(Math.atan2(pulley.z - w.z, pulley.y - w.y));
        expect(Math.abs(side)).toBeLessThan(15);
        expect(Math.abs(deg(Math.atan2(w.x - e.x, w.y - e.y)))).toBeLessThan(15);
      }
    },
  );

  it("lowers the elbow at the bottom with the forearm held on its line: elbow flexion follows (Tony, 2026-10-10)", () => {
    const p = { ...pulldownProfileFor("neutral_bar"), noiseM: 0 };
    const target = pulldownForearmToCableDeg(p, 1);
    const elevation = p.joints.shoulder_elevation.map((x, i) => (i === 3 ? x - 20 : x));
    const lowered = { ...p, joints: { ...p.joints, shoulder_elevation: elevation } };
    // Left alone, the forearm tips off its line…
    expect(Math.abs(pulldownForearmToCableDeg(lowered, 1) - target)).toBeGreaterThan(10);
    // …the solved bend puts it back, with more elbow flexion and the hand still on the bar.
    const bend = elbowFlexionHoldingForearm(lowered, 3, target);
    expect(bend).toBeGreaterThan(p.joints.elbow_flexion[3]! + 5);
    const solved = { ...lowered, joints: { ...lowered.joints, elbow_flexion: lowered.joints.elbow_flexion.map((x, i) => (i === 3 ? bend : x)) } };
    expect(pulldownForearmToCableDeg(solved, 1)).toBeCloseTo(target, 0);
    const b = poseAt(1, solved);
    expect(Math.abs(b.left_wrist.x - b.right_wrist.x) / 0.4).toBeCloseTo(p.gripWidthXShoulder, 2);
    // Unchanged when the forearm is already where it should be.
    expect(elbowFlexionHoldingForearm(p, 3, target)).toBe(p.joints.elbow_flexion[3]);
  });

  it.each(Object.keys(PULLDOWN_SETUPS) as PulldownSetup[])("%s: the smooth curve hits every key, moves one way between keys and has no corners", (setup) => {
    const base = pulldownProfileFor(setup);
    const N = 200;
    // Largest jump in a joint's curvature (third difference), where the old curve kinks at the keys.
    const corner = (p: typeof base, n: (typeof PULLDOWN_JOINT_NAMES)[number]) => {
      const a = Array.from({ length: N + 1 }, (_, i) => jointsAt(p, i / N)[n]);
      return Math.max(...a.slice(2, -1).map((x, i) => Math.abs(a[i + 3]! - 3 * x + 3 * a[i + 1]! - a[i]!)));
    };
    const smooth = { ...base, jointCurve: "smooth" as const };
    for (const n of PULLDOWN_JOINT_NAMES) {
      PULLDOWN_KEY_AT.forEach((k, i) => expect(jointsAt(smooth, k)[n]).toBeCloseTo(smooth.joints[n][i]!, 9));
      for (let i = 0; i < PULLDOWN_KEY_AT.length - 1; i++) {
        const [lo, hi] = [smooth.joints[n][i]!, smooth.joints[n][i + 1]!].sort((x, y) => x - y);
        for (let t = PULLDOWN_KEY_AT[i]!; t <= PULLDOWN_KEY_AT[i + 1]!; t += 0.01) {
          const y = jointsAt(smooth, t)[n];
          expect(y).toBeGreaterThanOrEqual(lo! - 1e-9);
          expect(y).toBeLessThanOrEqual(hi! + 1e-9);
        }
      }
    }
    expect(corner(smooth, "elbow_flexion")).toBeLessThan(corner(base, "elbow_flexion") / 10);
  });

  it("paces each part of the pull and return as set, and Tier 1 reads the shares back (Tony, 2026-10-10)", () => {
    const pacing = { concentric: [0.2, 0.5, 0.3], eccentric: [0.4, 0.4, 0.2] } as const;
    for (const setup of Object.keys(PULLDOWN_SETUPS) as PulldownSetup[]) {
      for (const p of [{ ...pulldownProfileFor(setup), pacing: DEFAULT_PULLDOWN_PACING }, { ...pulldownProfileFor(setup), pacing: { concentric: [...pacing.concentric], eccentric: [...pacing.eccentric] } as typeof DEFAULT_PULLDOWN_PACING }]) {
        for (const r of analyzePulldown(synthesizePulldown(p, { camera: at(135) })).reps) {
          const f = r.features;
          const got = [f.concentric_part1_share, f.concentric_part2_share, f.concentric_part3_share, f.eccentric_part1_share, f.eccentric_part2_share, f.eccentric_part3_share];
          [...p.pacing!.concentric, ...p.pacing!.eccentric].forEach((want, i) => expect(Math.abs(got[i]! - want)).toBeLessThan(0.12)); // the 5% bands at each end trim the slow ends
        }
      }
    }
  });

  it("tempo consistency needs 2+ reps: a single rep is reported, not judged", () => {
    const r = analyzePulldown(synthesizePulldown({ ...pulldownProfileFor("wide_overhand"), reps: 1 }, { camera: at(135) })).reps;
    expect(r).toHaveLength(1);
    expect(r[0]!.checks.find((c) => c.id === "tempo_consistent")!.status).toBe("info");
    expect(evaluatePulldownRep({ ...r[0]!.features, tempo_variation_pct: 30 }).find((c) => c.id === "tempo_consistent")!.status).toBe("fail");
  });

  it("judges each grip with its own limits (Tony, 2026-10-10)", () => {
    const wide = pulldownParamsFor(DEFAULT_PULLDOWN_PARAMS, "wide_overhand");
    const narrow = pulldownParamsFor(DEFAULT_PULLDOWN_PARAMS, "narrow_underhand");
    expect(wide.checks).toEqual(DEFAULT_PULLDOWN_PARAMS.checks);
    expect(narrow.checks.find((c) => c.id === "pull_along_line")).toMatchObject({ min: 2, max: 9 });
    for (const az of [90, 135, 180, 225]) {
      const p = pulldownProfileFor("narrow_underhand");
      for (const rep of analyzePulldown(synthesizePulldown(p, { camera: at(az) }), narrow).reps) {
        expect(rep.checks.filter((c) => c.status === "fail").map((c) => c.id)).toEqual([]);
      }
    }
    // The wide grip's limits still catch the narrow grip's straighter line of pull.
    const shared = analyzePulldown(synthesizePulldown(pulldownProfileFor("narrow_underhand"), { camera: at(135) })).reps;
    expect(shared.some((r) => r.checks.find((c) => c.id === "pull_along_line")!.status === "fail")).toBe(true);
    // null removes a limit; an unknown check is refused.
    const raw = { ...DEFAULT_PULLDOWN_PARAMS, variations: { x: { no_yank: { max: null } } } };
    expect(pulldownParamsFor(parsePulldownParams(raw), "x").checks.find((c) => c.id === "no_yank")!.max).toBeUndefined();
    expect(() => parsePulldownParams({ ...raw, variations: { x: { nope: { max: 1 } } } })).toThrow(/unknown check/);
  });

  it("puts a fault on top of a variation and keeps the variation's grip", () => {
    const p = pulldownProfileFor("narrow_underhand", "fast_eccentric");
    expect(p.gripType).toBe("underhand");
    expect(p.gripWidthXShoulder).toBe(1.1);
    expect(p.eccentricS).toBe(PULLDOWN_VARIANTS.fast_eccentric.eccentricS);
  });
});

describe("lifter built from the posture check (Tony, 2026-10-10)", () => {
  it("measures the synthetic lifter's own bones back from its posture captures", () => {
    const body = pulldownBodyFromSkeleton(calibrateSkeleton(synthesizePostureScreen(POSTURE_VARIANTS.neutral)));
    expect(body.upperArm.left).toBeCloseTo(PULLDOWN_SYNTH_BODY.upperArm.left, 2);
    expect(body.forearm.right).toBeCloseTo(PULLDOWN_SYNTH_BODY.forearm.right, 2);
    expect(body.thigh).toBeCloseTo(PULLDOWN_SYNTH_BODY.thigh, 2);
  });

  it("moves that person's bones through the same joint angles", () => {
    const body = { ...PULLDOWN_SYNTH_BODY, upperArm: { left: 0.34, right: 0.33 }, forearm: { left: 0.29, right: 0.29 } };
    const seq = synthesizePulldown({ ...GOOD_PULLDOWN, body, noiseM: 0 });
    for (const f of [0, 40, 80]) {
      expect(segmentLength(seq, f, "left_shoulder", "left_elbow")).toBeCloseTo(0.34, 3);
      expect(segmentLength(seq, f, "right_shoulder", "right_elbow")).toBeCloseTo(0.33, 3);
      expect(segmentLength(seq, f, "left_elbow", "left_wrist")).toBeCloseTo(0.29, 3);
    }
    const flex = (b?: typeof body) => pulldownSeries(synthesizePulldown({ ...GOOD_PULLDOWN, body: b, noiseM: 0 })).metrics.left_elbow_flexion_deg![40]!;
    expect(flex(body)).toBeCloseTo(flex(), 0);
  });
});

describe("grip from arm lengths", () => {
  it("by default puts the hands under the middle of the elbow's swing: Tony's 2.2x on the synthetic lifter", () => {
    expect(recommendedGrip(PULLDOWN_SYNTH_ARMS).gripWidthXShoulder).toBeCloseTo(2.2, 1);
  });

  it("bottom-only rule: forearms vertical at the bottom (synthetic lifter: 2.0x)", () => {
    const g = recommendedGrip(PULLDOWN_SYNTH_ARMS, { bottomArmElevationDeg: 42, forearmTiltDeg: 0 });
    expect(g.gripWidthXShoulder).toBeCloseTo(2.0, 1);
    // The formula's bar height matches the synthetic rep at that grip, at the arm angle the rep actually finishes with
    // (narrowing the grip on the same joint keyframes closes the arms a little).
    const reps = analyzePulldown(synthesizePulldown({ ...GOOD_PULLDOWN, gripWidthXShoulder: g.gripWidthXShoulder, noiseM: 0 }), undefined, {}).reps;
    const mean = (f: (r: (typeof reps)[number]) => number) => reps.reduce((s, r) => s + f(r), 0) / reps.length;
    const bar = mean((r) => r.features.bar_bottom_rel_shoulder_m!);
    const elevation = mean((r) => r.features.humerothoracic_elevation_bottom_deg!);
    const atThatAngle = recommendedGrip(PULLDOWN_SYNTH_ARMS, { bottomArmElevationDeg: elevation, forearmTiltDeg: 0 });
    // The formula assumes a vertical forearm; the synthetic one is a few degrees off, worth ~0.5 cm.
    expect(Math.abs(bar - atThatAngle.barAboveShouldersM)).toBeLessThan(0.025);
  });

  it("widens the grip for a longer upper arm at the same shoulder width", () => {
    const base = recommendedGrip(PULLDOWN_SYNTH_ARMS).gripWidthM;
    const longArms = recommendedGrip({ ...PULLDOWN_SYNTH_ARMS, upperArmM: 0.34 }).gripWidthM;
    expect(longArms - base).toBeCloseTo(0.04 * (Math.sin((42 * Math.PI) / 180) + 0.93), 6);
  });

  it("stops every joint at its end range, so a keyframe past anatomy can't be simulated (Tony, 2026-10-10)", () => {
    for (const id of Object.keys(JOINT_END_RANGES)) expect(id in JOINT_MOTIONS).toBe(true);
    const p = pulldownProfileFor("wide_overhand");
    const past = { ...p, joints: { ...p.joints, elbow_flexion: [11, 80, 170, 175], scapular_elevation: [0.03, 0, -0.08, -0.1] } };
    const [, elbowMax] = jointLimits("elbow_flexion");
    const [depressionMax] = jointLimits("scapular_elevation");
    for (let prog = 0; prog <= 1.0001; prog += 0.05) {
      const j = jointsAt(past, prog);
      expect(j.elbow_flexion).toBeLessThanOrEqual(elbowMax);
      expect(j.scapular_elevation).toBeGreaterThanOrEqual(depressionMax);
    }
    expect(jointsAt(past, 1).elbow_flexion).toBe(elbowMax);
    // Every good-rep baseline sits inside the end ranges, so the stops never change Tony's baselines.
    for (const setup of Object.keys(PULLDOWN_SETUPS) as PulldownSetup[])
      for (const [name, keys] of Object.entries(pulldownProfileFor(setup).joints)) {
        if (name === "scapular_upward_rotation") continue;
        const [lo, hi] = jointLimits(name as keyof typeof JOINT_MOTIONS);
        for (const x of keys) expect(x >= lo && x <= hi).toBe(true);
      }
  });

  it("internally rotates the shoulder by flaring the elbow out, hand kept on the bar (Tony, 2026-10-10)", () => {
    const p = { ...pulldownProfileFor("neutral_bar"), noiseM: 0 };
    const k = 2;
    const at = PULLDOWN_KEY_AT[k]!;
    const now = pulldownArmOnBar(p, at);
    const plane = planeForShoulderRotation(p, k, now.shoulderRotationDeg - 10)!;
    expect(plane).toBeLessThan(now.shoulderPlaneOfElevationDeg - 2);
    const q = { ...p, joints: { ...p.joints, shoulder_plane_of_elevation: p.joints.shoulder_plane_of_elevation.map((x, i) => (i === k ? plane : x)) } };
    expect(pulldownArmOnBar(q, at).shoulderRotationDeg).toBeCloseTo(now.shoulderRotationDeg - 10, 0);
    const b = poseAt(at, q);
    expect(Math.abs(b.left_wrist.x - b.right_wrist.x) / 0.4).toBeCloseTo(p.gripWidthXShoulder, 2);
  });
});
