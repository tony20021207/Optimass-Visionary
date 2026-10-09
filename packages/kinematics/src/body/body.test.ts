import { describe, expect, it } from "vitest";
import { pulldown, posture } from "../index";
import { calibrateSkeleton, fitToSkeleton } from "./index";

const skeleton = calibrateSkeleton(posture.synthesizePostureScreen(posture.NEUTRAL_POSTURE));

describe("personal skeleton from the posture check", () => {
  it("recovers the synthetic body's segment lengths within 1 cm", () => {
    const expected = { left_upper_arm: 0.3, right_forearm: 0.27, left_thigh: 0.43, right_shin: 0.43, hip_width: 0.2, shoulder_width: 0.4 };
    for (const [seg, len] of Object.entries(expected)) {
      expect(Math.abs(skeleton.segments[seg as keyof typeof skeleton.segments].lengthM - len)).toBeLessThan(0.01);
    }
    expect(skeleton.proportions.thigh_to_shin).toBeCloseTo(1, 1);
    expect(Math.abs(skeleton.sideDifferenceM.thigh)).toBeLessThan(0.01);
  });

  it("rescales to real meters when the user's height is given", () => {
    const tall = calibrateSkeleton(posture.synthesizePostureScreen(posture.NEUTRAL_POSTURE), { heightM: 1.9 });
    expect(tall.scale).toBeGreaterThan(1);
    expect(tall.proportions.thigh_to_shin).toBeCloseTo(skeleton.proportions.thigh_to_shin!, 6);
  });
});

describe("fitting a 45° clip to the skeleton", () => {
  const rms = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]!) ** 2, 0) / a.length);

  it("never makes joint angles worse and trims depth-noise error on average", () => {
    // Modest by design: one frame at a time, bone lengths only. Gains on real clips are unmeasured.
    const truth = pulldown.pulldownSeries(pulldown.synthesizePulldown({ ...pulldown.GOOD_PULLDOWN, noiseM: 0 }), { smoothingWindow: 1 });
    const noisy = pulldown.synthesizePulldown({ ...pulldown.GOOD_PULLDOWN, noiseM: 0.008 });
    const fitted = fitToSkeleton(noisy, skeleton).sequence;
    const raw = pulldown.pulldownSeries(noisy, { smoothingWindow: 1 });
    const fit = pulldown.pulldownSeries(fitted, { smoothingWindow: 1 });
    const ratios = ["left_elbow_flexion_deg", "right_elbow_flexion_deg", "left_humerothoracic_elevation_deg", "right_humerothoracic_elevation_deg"].map(
      (m) => rms(fit.metrics[m]!, truth.metrics[m]!) / rms(raw.metrics[m]!, truth.metrics[m]!),
    );
    for (const r of ratios) expect(r).toBeLessThan(1.02);
    expect(ratios.reduce((a, b) => a + b, 0) / ratios.length).toBeLessThan(0.92);
  });

  it("leaves every fitted bone at its calibrated length", () => {
    const fitted = fitToSkeleton(pulldown.synthesizePulldown(pulldown.GOOD_PULLDOWN), skeleton).sequence;
    const f = fitted.frames[40]!.worldLandmarks;
    const len = (a: number, b: number) => Math.hypot(f[a]!.x - f[b]!.x, f[a]!.y - f[b]!.y, f[a]!.z - f[b]!.z);
    expect(len(13, 15)).toBeCloseTo(skeleton.segments.left_forearm.lengthM, 6);
    expect(len(12, 14)).toBeCloseTo(skeleton.segments.right_upper_arm.lengthM, 6);
  });

  it("analyzePulldown uses the skeleton when given and still passes the good set", () => {
    const report = pulldown.analyzePulldown(pulldown.synthesizePulldown(pulldown.GOOD_PULLDOWN), undefined, { skeleton });
    expect(report.fit?.maxBoneErrorM).toHaveLength(report.series.timestampsMs.length);
    expect(report.reps.flatMap((r) => r.checks.filter((c) => c.status === "fail"))).toEqual([]);
  });

  it("reports the grip against the one the skeleton's arm lengths call for", () => {
    const report = pulldown.analyzePulldown(pulldown.synthesizePulldown(pulldown.GOOD_PULLDOWN), undefined, { skeleton });
    expect(report.recommendedGrip?.gripWidthXShoulder).toBeGreaterThan(1);
    // The baseline's 2.2x is wider than the vertical-forearm grip, so the ratio sits above 1.
    for (const r of report.reps) expect(r.features.grip_vs_recommended).toBeGreaterThan(1);
  });
});
