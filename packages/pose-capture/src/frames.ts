import { POSE_LANDMARK_COUNT, POSE_LANDMARK_NAMES } from "@optimass/types";
import type { NormalizedLandmark, PoseFrame, PoseLandmarkName, WorldLandmark } from "@optimass/types";
import { DEFAULT_ONE_EURO, OneEuroFilter } from "./one-euro";
import type { OneEuroParams } from "./one-euro";

/** One pose as MediaPipe returns it (fields may be missing or slightly out of range). */
export interface RawLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}
export interface RawPose {
  landmarks: RawLandmark[];
  worldLandmarks: RawLandmark[];
}

const unit = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? 0 : Math.min(1, Math.max(0, v)));

/** MediaPipe output → PoseFrame. Returns null when the pose isn't complete (no person found). */
export function toPoseFrame(raw: RawPose | null, frameIndex: number, timestampMs: number): PoseFrame | null {
  if (!raw || raw.landmarks.length !== POSE_LANDMARK_COUNT || raw.worldLandmarks.length !== POSE_LANDMARK_COUNT) return null;
  const landmarks: NormalizedLandmark[] = raw.landmarks.map((l) => ({
    x: l.x,
    y: l.y,
    z: l.z,
    visibility: unit(l.visibility),
    ...(l.presence === undefined ? {} : { presence: unit(l.presence) }),
  }));
  // World landmarks carry no visibility of their own in newer MediaPipe builds; borrow the image landmark's.
  const worldLandmarks: WorldLandmark[] = raw.worldLandmarks.map((l, i) => ({
    x: l.x,
    y: l.y,
    z: l.z,
    visibility: unit(l.visibility ?? raw.landmarks[i]!.visibility),
  }));
  return { frameIndex, timestampMs, landmarks, worldLandmarks };
}

/** Landmarks MediaPipe wasn't sure about. Their positions are guesses: flag them rather than use them silently. */
export function lowVisibilityLandmarks(frame: PoseFrame, minVisibility: number): PoseLandmarkName[] {
  return POSE_LANDMARK_NAMES.filter((_, i) => frame.landmarks[i]!.visibility < minVisibility);
}

/**
 * Smooths frames one at a time with a One Euro filter per landmark coordinate. A landmark below minVisibility
 * passes through unsmoothed (keeping its low visibility as the flag) and doesn't feed the filter, which restarts
 * when the landmark is seen again, so a guess never bends the smoothed path of a visible joint.
 */
export function createFrameSmoother(minVisibility: number, params: OneEuroParams = DEFAULT_ONE_EURO) {
  const make = () => Array.from({ length: POSE_LANDMARK_COUNT }, () => [0, 1, 2].map(() => new OneEuroFilter(params)));
  const image = make();
  const world = make();

  const smooth = <L extends { x: number; y: number; z: number; visibility: number }>(list: L[], filters: OneEuroFilter[][], t: number, seen: boolean[]) =>
    list.map((l, i) => {
      const f = filters[i]!;
      if (!seen[i]) {
        f.forEach((x) => x.reset());
        return l;
      }
      return { ...l, x: f[0]!.filter(l.x, t), y: f[1]!.filter(l.y, t), z: f[2]!.filter(l.z, t) };
    });

  return (frame: PoseFrame): PoseFrame => {
    const seen = frame.landmarks.map((l) => l.visibility >= minVisibility);
    return {
      ...frame,
      landmarks: smooth(frame.landmarks, image, frame.timestampMs, seen),
      worldLandmarks: smooth(frame.worldLandmarks, world, frame.timestampMs, seen),
    };
  };
}
