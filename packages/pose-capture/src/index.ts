import type { CameraView, PoseFrame, PoseSequence } from "@optimass/types";

export const MODULE = "M4" as const;

export interface CaptureOptions {
  exerciseId: string;
  cameraView: CameraView;
  /** Landmarks below this visibility are treated as missing. */
  minVisibility?: number;
}

export interface PoseCapture {
  /** Called for every processed frame. Returns an unsubscribe function. */
  onFrame(listener: (frame: PoseFrame) => void): () => void;
  start(source: HTMLVideoElement | MediaStream): Promise<void>;
  /** Stops capture and returns everything captured so far. */
  stop(): PoseSequence;
}

const notImplemented = (fn: string): never => {
  throw new Error(`${fn} is not implemented yet (M4, see docs/specs/M4.md)`);
};

export function createPoseCapture(_options: CaptureOptions): PoseCapture {
  return notImplemented("createPoseCapture");
}
