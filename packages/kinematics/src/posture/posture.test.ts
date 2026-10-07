import { describe, expect, it } from "vitest";
import { CAPTURE_PROTOCOL } from "../camera";
import {
  DEFAULT_POSTURE_PARAMS,
  NEUTRAL_POSTURE,
  POSTURE_VARIANTS,
  analyzePosture,
  parsePostureParams,
  postureFeatures,
  synthesizePostureScreen,
  type PostureVariant,
} from "./index";

describe("posture screen", () => {
  it("captures one still clip per protocol view", () => {
    const captures = synthesizePostureScreen(NEUTRAL_POSTURE);
    expect(captures.map((c) => c.view)).toEqual(["anterior", "posterior", "left", "right"]);
    expect(captures[0]!.sequence.cameraView).toBe("frontal");
    expect(captures[2]!.sequence.cameraView).toBe("sagittal");
    expect(captures[0]!.sequence.frames).toHaveLength(CAPTURE_PROTOCOL.postureScreen.holdSeconds * 30);
  });

  it("measures the same posture from every view when there is no noise", () => {
    const captures = synthesizePostureScreen({ ...POSTURE_VARIANTS.knee_valgus, forwardHeadM: 0.05, noiseM: 0 });
    const [first, ...rest] = captures.map((c) => postureFeatures(c.sequence));
    for (const other of rest) {
      for (const [k, x] of Object.entries(first!)) expect(other[k as keyof typeof other]).toBeCloseTo(x, 4);
    }
    expect(first!.head_forward_m).toBeCloseTo(0.05, 4);
    expect(first!.left_knee_valgus_deg).toBeCloseTo(12, 0);
  });

  it("neutral standing passes every check", () => {
    const { checks } = analyzePosture(synthesizePostureScreen(NEUTRAL_POSTURE));
    expect(checks.filter((c) => c.status === "fail")).toEqual([]);
  });

  it.each([
    ["forward_head", ["forward_head_posture"]],
    ["rounded_shoulders", ["rounded_shoulders"]],
    ["shoulder_drop", ["shoulder_asymmetry"]],
    ["pelvic_drop", ["pelvic_obliquity"]],
    ["knee_valgus", ["knee_alignment"]],
    ["knee_hyperextension", ["knee_hyperextension"]],
  ] as const)("%s is flagged only as %j", (variant, findings) => {
    const { checks } = analyzePosture(synthesizePostureScreen(POSTURE_VARIANTS[variant as PostureVariant]));
    const failed = new Set(checks.filter((c) => c.status === "fail").map((c) => c.finding));
    expect([...failed]).toEqual([...findings]);
  });

  it("all posture parameters are marked as placeholders and parse", () => {
    expect(DEFAULT_POSTURE_PARAMS.checks.every((c) => c.placeholder)).toBe(true);
    expect(() => parsePostureParams({ checks: [{ id: "x", feature: "nope" }] })).toThrow(/unknown feature/);
  });
});
