import { describe, expect, it } from "vitest";
import { DEFAULT_SCAPULA_PREDICTIONS, parseScapulaPredictions, predictFromScapula, SCAPULA_CONSENT, scapulaFeatures, type ScapulaScreen } from "./scapula";

// Back view, user's left on the image's left; spine roots 200 px apart around x = 500.
const screen = (over: Partial<ScapulaScreen> = {}): ScapulaScreen => ({
  consent: true,
  left: { spineRoot: { x: 400, y: 300 }, inferiorAngle: { x: 410, y: 450 } },
  right: { spineRoot: { x: 600, y: 300 }, inferiorAngle: { x: 590, y: 450 } },
  ...over,
});

describe("scapula step of the posture check", () => {
  it("won't measure without consent, and has a warning to show", () => {
    expect(() => scapulaFeatures(screen({ consent: false }))).toThrow(/consent/);
    expect(SCAPULA_CONSENT.warning).toMatch(/sports bra/);
  });

  it("reads rotation, distance from the spine and height difference from tapped points", () => {
    const f = scapulaFeatures(screen());
    // Inferior angles 10 px closer to the spine than the spine roots: slight downward rotation, both sides alike.
    expect(f.left_scapula_upward_rotation_deg).toBeCloseTo(-3.81, 1);
    expect(f.right_scapula_upward_rotation_deg).toBeCloseTo(f.left_scapula_upward_rotation_deg!, 6);
    expect(f.left_scapula_to_spine).toBeCloseTo(90 / 200, 6);
    expect(f.inferior_angle_height_diff).toBeCloseTo(0, 6);
    expect(f.left_winging_grade).toBeUndefined();
  });

  it("uses meters when the scale is known, and the left side higher reads positive", () => {
    const f = scapulaFeatures(screen({ metersPerPixel: 0.001, left: { spineRoot: { x: 400, y: 300 }, inferiorAngle: { x: 370, y: 430 } } }));
    expect(f.inferior_angle_height_diff).toBeCloseTo(0.02, 6);
    expect(f.left_scapula_upward_rotation_deg).toBeGreaterThan(0);
    expect(f.left_scapula_to_spine).toBeCloseTo(0.13, 6);
  });

  it("predicts movement errors from Tony's table, and nothing from the empty default", () => {
    const f = scapulaFeatures(screen({ observed: { left: { winging: "obvious", anteriorTilt: "normal" }, right: { winging: "normal", anteriorTilt: "normal" } } }));
    expect(f.left_winging_grade).toBe(2);
    expect(DEFAULT_SCAPULA_PREDICTIONS.predictions).toEqual([]);
    expect(predictFromScapula(f, "lat_pulldown")).toEqual([]);
    const table = parseScapulaPredictions({
      version: "test",
      reviewedBy: null,
      predictions: [
        { id: "a", feature: "left_winging_grade", max: 0, finding: "test only", predicts: ["code_x"], exercises: ["lat_pulldown"] },
        { id: "b", feature: "right_winging_grade", max: 0, finding: "test only", predicts: ["code_x"] },
        { id: "c", feature: "left_winging_grade", max: 0, finding: "test only", predicts: ["code_y"], exercises: ["squat"] },
      ],
    });
    expect(predictFromScapula(f, "lat_pulldown", table)).toEqual([{ errorCode: "code_x", because: ["a"] }]);
  });

  it("rejects malformed tables", () => {
    expect(() => parseScapulaPredictions({ predictions: [{ id: "x", feature: "nope", max: 1, predicts: ["a"] }] })).toThrow(/unknown feature/);
    expect(() => parseScapulaPredictions({ predictions: [{ id: "x", feature: "left_winging_grade", predicts: ["a"] }] })).toThrow(/min or max/);
    expect(() => parseScapulaPredictions({ predictions: [{ id: "x", feature: "left_winging_grade", max: 1, predicts: [] }] })).toThrow(/predicts nothing/);
  });
});
