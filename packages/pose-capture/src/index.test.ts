import { describe, expect, it, vi } from "vitest";
import { POSE_LANDMARK, POSE_LANDMARK_COUNT, PoseFrame, PoseSequence } from "@optimass/types";
import { squatSagittal2Reps } from "@optimass/types/fixtures";
import { NoPoseFoundError, OneEuroFilter, processImage, createFrameSmoother, createPoseCapture, lowVisibilityLandmarks, toPoseFrame, trackingQuality } from "./index";
import type { CaptureDeps, PoseDetector, RawPose, SourceFrame } from "./index";

/** Deterministic noise so tests don't flake. */
const noise = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647 - 0.5;
};

const rawPose = (x: number, visibility = 0.9): RawPose => {
  const l = Array.from({ length: POSE_LANDMARK_COUNT }, () => ({ x, y: 0.5, z: 0, visibility }));
  return { landmarks: l, worldLandmarks: l.map((p) => ({ ...p, visibility: undefined })) };
};

const fakeImage = () => ({ close: vi.fn() }) as unknown as ImageBitmap;

/** A capture wired to scripted poses instead of a camera and MediaPipe. */
function scripted(poses: (RawPose | null)[], fps = 30): { deps: CaptureDeps; closed: () => boolean } {
  let closed = false;
  const detector: PoseDetector = {
    detect: async (_img, t) => poses[Math.round((t * fps) / 1000)] ?? null,
    close: () => {
      closed = true;
    },
  };
  async function* frames(): AsyncGenerator<SourceFrame> {
    for (let i = 0; i < poses.length; i++) yield { index: i, timestampMs: (i * 1000) / fps, image: fakeImage() };
  }
  return {
    deps: {
      createDetector: async () => detector,
      openSource: async () => ({ kind: "upload", width: 1080, height: 1920, fps, total: poses.length, frames: frames() }),
    },
    closed: () => closed,
  };
}

const video = {} as HTMLVideoElement;
const options = { exerciseId: "lat_pulldown", cameraView: "sagittal" as const };

describe("One Euro smoothing", () => {
  /** Squared error of raw vs filtered samples against the truth, skipping the first second. */
  const jitter = (truth: (t: number) => number) => {
    const rand = noise(7);
    const filter = new OneEuroFilter();
    let raw = 0;
    let smoothed = 0;
    for (let i = 0; i < 300; i++) {
      const t = (i * 1000) / 30;
      const measured = truth(t) + 0.02 * rand();
      const out = filter.filter(measured, t);
      if (i >= 30) {
        raw += (measured - truth(t)) ** 2;
        smoothed += (out - truth(t)) ** 2;
      }
    }
    return smoothed / raw;
  };

  it("cuts jitter on a joint held still", () => {
    expect(jitter(() => 0.5)).toBeLessThan(0.5);
  });

  it("doesn't add error on a joint moving through a 4 s rep", () => {
    expect(jitter((t) => 0.5 + 0.2 * Math.sin((2 * Math.PI * t) / 4000))).toBeLessThan(1);
  });

  it("leaves landmarks below minVisibility unsmoothed and restarts once they reappear", () => {
    const smooth = createFrameSmoother(0.5);
    const at = (i: number, x: number, v: number) => toPoseFrame(rawPose(x, v), i, i * 33)!;
    smooth(at(0, 0.2, 0.9));
    expect(smooth(at(1, 0.8, 0.1)).landmarks[0]!.x).toBe(0.8); // a guess passes through as is, still flagged
    expect(smooth(at(2, 0.6, 0.9)).landmarks[0]!.x).toBe(0.6); // fresh start, not pulled back toward 0.2
  });
});

describe("frames", () => {
  it("turns MediaPipe output into frames that parse as PoseFrame", () => {
    const raw = rawPose(0.4);
    raw.landmarks[3]!.visibility = 1.2;
    const frame = toPoseFrame(raw, 4, 133.3)!;
    expect(PoseFrame.parse(frame)).toEqual(frame);
    expect(frame.landmarks[3]!.visibility).toBe(1);
    expect(frame.worldLandmarks[0]!.visibility).toBeCloseTo(0.9);
  });

  it("returns null when no body was found", () => {
    expect(toPoseFrame(null, 0, 0)).toBeNull();
    expect(toPoseFrame({ landmarks: [], worldLandmarks: [] }, 0, 0)).toBeNull();
  });

  it("flags landmarks below minVisibility", () => {
    const frame = toPoseFrame(rawPose(0.4), 0, 0)!;
    frame.landmarks[POSE_LANDMARK.left_wrist]!.visibility = 0.2;
    expect(lowVisibilityLandmarks(frame, 0.5)).toEqual(["left_wrist"]);
  });
});

describe("createPoseCapture", () => {
  it("processes a whole video into a PoseSequence with ordered timestamps", async () => {
    const poses = Array.from({ length: 20 }, (_, i) => (i === 5 ? null : rawPose(0.3 + i * 0.01)));
    const { deps, closed } = scripted(poses);
    const progress: number[] = [];
    const seen: PoseFrame[] = [];
    const capture = createPoseCapture({ ...options, onProgress: (p) => progress.push(p) }, deps);
    capture.onFrame((f) => seen.push(f));
    await capture.start(video);
    const seq = capture.stop();

    expect(PoseSequence.parse(seq)).toBeTruthy();
    expect(seq.frames).toHaveLength(19); // the frame with no body is left out
    expect(seq.frames.map((f) => f.frameIndex)).not.toContain(5);
    const ts = seq.frames.map((f) => f.timestampMs);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    expect(seen).toHaveLength(19);
    expect(seq.source).toBe("upload");
    expect(seq.image).toEqual({ width: 1080, height: 1920 });
    expect(progress.at(-1)).toBe(1);
    expect(capture.framesSampled).toBe(20);
    expect(closed()).toBe(true);
  });

  it("reads a still photo as a one-frame sequence", async () => {
    const { deps } = scripted([rawPose(0.4)], 1);
    const seq = await processImage(new Blob(), options, deps);
    expect(seq.frames).toHaveLength(1);
    expect(PoseSequence.parse(seq).frames[0]!.timestampMs).toBe(0);
  });

  it("says so when no body was found anywhere", async () => {
    const { deps } = scripted([null, null, null]);
    const capture = createPoseCapture(options, deps);
    await capture.start(video);
    expect(() => capture.stop()).toThrow(NoPoseFoundError);
  });

  it("keeps the shared squat fixture valid through smoothing", () => {
    const smooth = createFrameSmoother(0.5);
    squatSagittal2Reps.frames.forEach((f) => expect(PoseFrame.safeParse(smooth(f)).success).toBe(true));
  });
});

describe("trackingQuality", () => {
  it("reports how often each needed landmark was seen, out of every sampled frame", () => {
    const frames = [0.9, 0.9, 0.2].map((v, i) => {
      const f = toPoseFrame(rawPose(0.5), i, i * 33)!;
      f.landmarks[POSE_LANDMARK.left_elbow]!.visibility = v;
      return f;
    });
    const q = trackingQuality({ frames }, 4, ["left_elbow", "left_hip"], 0.5);
    expect(q).toEqual({ framesSampled: 4, framesWithPose: 3, seen: { left_elbow: 0.5, left_hip: 0.75 } });
  });
});
