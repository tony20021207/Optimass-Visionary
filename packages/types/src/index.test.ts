import { describe, expect, it } from "vitest";
import { DiagnosticReport, KinematicFinding, POSE_LANDMARK, POSE_LANDMARK_COUNT, PoseFrame } from "./index";
import { diagnosticReportSquatFrontal, poseSequences, squatFrontalValgus } from "./fixtures";

describe("pose contracts", () => {
  it("has MediaPipe's 33 landmarks in order", () => {
    expect(POSE_LANDMARK_COUNT).toBe(33);
    expect(POSE_LANDMARK.nose).toBe(0);
    expect(POSE_LANDMARK.left_knee).toBe(25);
    expect(POSE_LANDMARK.right_foot_index).toBe(32);
  });

  it("rejects a frame with the wrong landmark count", () => {
    const frame = squatFrontalValgus.frames[0]!;
    expect(PoseFrame.safeParse({ ...frame, landmarks: frame.landmarks.slice(1) }).success).toBe(false);
  });

  it("fixtures are valid, ordered sequences", () => {
    for (const seq of poseSequences) {
      const ts = seq.frames.map((f) => f.timestampMs);
      expect(ts).toEqual([...ts].sort((a, b) => a - b));
      expect(seq.frames.every((f, i) => f.frameIndex === i)).toBe(true);
    }
  });
});

describe("diagnostic contracts", () => {
  it("findings must declare a camera view", () => {
    const { requiredView: _omit, ...noView } = diagnosticReportSquatFrontal.findings[0]!;
    expect(KinematicFinding.safeParse(noView).success).toBe(false);
  });

  it("hypotheses must carry a screening test", () => {
    const report = structuredClone(diagnosticReportSquatFrontal);
    const { screeningTest: _omit, ...h } = report.hypotheses[0]!;
    expect(DiagnosticReport.safeParse({ ...report, hypotheses: [h] }).success).toBe(false);
  });

  it("rejects findings filmed from the wrong view", () => {
    const report = structuredClone(diagnosticReportSquatFrontal);
    expect(DiagnosticReport.safeParse({ ...report, cameraView: "sagittal" }).success).toBe(false);
  });

  it("rejects dangling references between tiers", () => {
    const report = structuredClone(diagnosticReportSquatFrontal);
    report.prescriptions[0]!.hypothesisId = "missing";
    expect(DiagnosticReport.safeParse(report).success).toBe(false);
  });
});
