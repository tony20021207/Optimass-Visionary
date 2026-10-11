import type { CameraView, PoseFrame, PoseSequence } from "@optimass/types";
import { DEFAULT_MIN_VISIBILITY, DEFAULT_SAMPLE_FPS, DEFAULT_WASM_BASE_PATH, POSE_MODEL_URLS } from "./config";
import type { PoseModel } from "./config";
import { createWorkerDetector } from "./detector";
import type { PoseDetector } from "./detector";
import { createFrameSmoother, toPoseFrame } from "./frames";
import type { OneEuroParams } from "./one-euro";
import { cameraSource, imageSource, videoFileSource } from "./sources";
import type { FrameSource } from "./sources";

export interface CaptureOptions {
  exerciseId: string;
  cameraView: CameraView;
  /** Landmarks below this visibility are treated as missing. */
  minVisibility?: number;
  /** Frames per second sampled from an uploaded video. */
  sampleFps?: number;
  /** Which MediaPipe model to load. "full" by default. */
  model?: PoseModel;
  /** Where the web app serves MediaPipe's WASM files. */
  wasmBasePath?: string;
  /** Model file URL, overriding `model`. */
  modelUrl?: string;
  /** Prebuilt worker script to use instead of this package's worker (see createWorkerDetector). */
  workerUrl?: string;
  /** One Euro filter settings, or false to keep MediaPipe's output as is. */
  smoothing?: OneEuroParams | false;
  /** Share of an uploaded video processed so far (0..1). */
  onProgress?: (done: number) => void;
  /** Aborting stops capture, like stop(), and releases the worker. */
  signal?: AbortSignal;
}

export interface PoseCapture {
  /** Called for every processed frame. Returns an unsubscribe function. */
  onFrame(listener: (frame: PoseFrame) => void): () => void;
  /**
   * Starts capture. For an uploaded video this resolves once the whole video is processed; for a camera it
   * resolves once frames are flowing, and capture runs until stop().
   */
  start(source: HTMLVideoElement | MediaStream | Blob): Promise<void>;
  /** Stops capture and returns everything captured so far. Throws if no body was found in any frame. */
  stop(): PoseSequence;
  /** Frames looked at so far, with or without a body in them. */
  readonly framesSampled: number;
}

/** Swappable parts, so the loop can be tested without a browser, camera or model. */
export interface CaptureDeps {
  createDetector?: (options: Required<Pick<CaptureOptions, "model" | "wasmBasePath">> & Pick<CaptureOptions, "modelUrl" | "workerUrl">) => Promise<PoseDetector>;
  openSource?: (source: HTMLVideoElement | MediaStream | Blob, fps: number, signal: AbortSignal) => Promise<FrameSource>;
}

export class NoPoseFoundError extends Error {
  constructor() {
    super("No body was found in the video. Check the whole body is in frame and well lit.");
    this.name = "NoPoseFoundError";
  }
}

// crypto.randomUUID only exists on https/localhost; a phone testing against a dev server over the LAN has neither.
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `seq-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const isStream = (s: unknown): s is MediaStream => typeof MediaStream !== "undefined" && s instanceof MediaStream;

export function createPoseCapture(options: CaptureOptions, deps: CaptureDeps = {}): PoseCapture {
  const minVisibility = options.minVisibility ?? DEFAULT_MIN_VISIBILITY;
  const sampleFps = options.sampleFps ?? DEFAULT_SAMPLE_FPS;
  const createDetector =
    deps.createDetector ?? ((o) => createWorkerDetector(o.wasmBasePath, o.modelUrl ?? POSE_MODEL_URLS[o.model], o.workerUrl));
  const openSource =
    deps.openSource ??
    ((s, fps, signal) => (s instanceof Blob ? imageSource(s) : isStream(s) ? cameraSource(s, signal) : videoFileSource(s, fps, signal)));

  const listeners = new Set<(f: PoseFrame) => void>();
  const frames: PoseFrame[] = [];
  const abort = new AbortController();
  options.signal?.addEventListener("abort", () => abort.abort(), { once: true });
  let meta: Pick<FrameSource, "kind" | "width" | "height" | "fps"> | null = null;
  let detector: PoseDetector | null = null;
  let sampled = 0;
  let started = false;

  const run = async (src: FrameSource) => {
    const smooth = options.smoothing === false ? (f: PoseFrame) => f : createFrameSmoother(minVisibility, options.smoothing);
    try {
      for await (const f of src.frames) {
        if (abort.signal.aborted) {
          f.image.close();
          break;
        }
        const raw = await detector!.detect(f.image, f.timestampMs);
        if (abort.signal.aborted) break;
        sampled = f.index + 1;
        const frame = toPoseFrame(raw, f.index, f.timestampMs);
        if (frame) {
          const out = smooth(frame);
          frames.push(out);
          listeners.forEach((l) => l(out));
        }
        if (src.total) options.onProgress?.(Math.min(1, sampled / src.total));
      }
    } finally {
      detector?.close();
      detector = null;
    }
  };

  return {
    get framesSampled() {
      return sampled;
    },
    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async start(source) {
      if (started) throw new Error("This capture was already started; create a new one");
      started = true;
      detector = await createDetector({
        model: options.model ?? "full",
        wasmBasePath: options.wasmBasePath ?? DEFAULT_WASM_BASE_PATH,
        modelUrl: options.modelUrl,
        workerUrl: options.workerUrl,
      });
      let src: FrameSource;
      try {
        src = await openSource(source, sampleFps, abort.signal);
      } catch (e) {
        detector.close();
        detector = null;
        throw e;
      }
      meta = { kind: src.kind, width: src.width, height: src.height, fps: src.fps };
      if (src.kind === "upload") await run(src);
      else void run(src).catch(() => abort.abort());
    },
    stop() {
      abort.abort();
      if (!meta || frames.length === 0) throw new NoPoseFoundError();
      return {
        id: newId(),
        exerciseId: options.exerciseId,
        cameraView: options.cameraView,
        fps: meta.fps,
        image: { width: meta.width, height: meta.height },
        source: meta.kind,
        frames: [...frames],
      };
    },
  };
}

/** Processes a whole uploaded video and returns its pose sequence. */
export async function processVideo(video: HTMLVideoElement, options: CaptureOptions, deps?: CaptureDeps) {
  const capture = createPoseCapture(options, deps);
  await capture.start(video);
  return { sequence: capture.stop(), framesSampled: capture.framesSampled };
}

/** Finds the body in one still photo (e.g. a posture-check view) and returns it as a one-frame sequence. */
export async function processImage(image: Blob, options: CaptureOptions, deps?: CaptureDeps) {
  const capture = createPoseCapture(options, deps);
  await capture.start(image);
  return capture.stop();
}
