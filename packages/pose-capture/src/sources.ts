/** A frame handed to the detector. */
export interface SourceFrame {
  /** Position in the sampled sequence, from 0. */
  index: number;
  timestampMs: number;
  image: ImageBitmap;
}

export interface FrameSource {
  kind: "upload" | "camera";
  width: number;
  height: number;
  fps: number;
  /** Frames this source will produce, when known (uploads). */
  total?: number;
  frames: AsyncIterable<SourceFrame>;
}

/** Bigger frames only cost transfer time: the pose model looks at 256×256. */
const MAX_FRAME_WIDTH = 960;

const grab = (video: HTMLVideoElement) => {
  const w = video.videoWidth;
  return w > MAX_FRAME_WIDTH
    ? createImageBitmap(video, { resizeWidth: MAX_FRAME_WIDTH, resizeHeight: Math.round((video.videoHeight * MAX_FRAME_WIDTH) / w) })
    : createImageBitmap(video);
};

const once = (target: EventTarget, event: string, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const done = () => {
      target.removeEventListener("error", fail);
      resolve();
    };
    const fail = () => reject(new Error("The video couldn't be read"));
    target.addEventListener(event, done, { once: true });
    target.addEventListener("error", fail, { once: true });
    signal.addEventListener("abort", done, { once: true });
  });

/**
 * An uploaded or recorded video, stepped through at a fixed rate by seeking. Every sampled frame is processed
 * (none dropped), so the result doesn't depend on how fast the phone is; it just takes longer on a slow one.
 */
export async function videoFileSource(video: HTMLVideoElement, fps: number, signal: AbortSignal): Promise<FrameSource> {
  video.pause();
  if (video.readyState < 2) await once(video, "loadeddata", signal);
  const step = 1 / fps;
  const total = Math.max(1, Math.floor(video.duration / step + 1e-6));
  async function* frames() {
    for (let i = 0; i < total && !signal.aborted; i++) {
      const t = i * step;
      if (Math.abs(video.currentTime - t) > 1e-4 || i === 0) {
        const seeked = once(video, "seeked", signal);
        video.currentTime = t;
        await seeked;
      }
      if (signal.aborted) return;
      yield { index: i, timestampMs: t * 1000, image: await grab(video) };
    }
  }
  return { kind: "upload", width: video.videoWidth, height: video.videoHeight, fps, total, frames: frames() };
}

/**
 * A live camera. Frames arrive in real time; while the detector is busy the newest frame waits and older ones
 * are skipped, so capture never falls behind the lifter.
 */
export async function cameraSource(stream: MediaStream, signal: AbortSignal): Promise<FrameSource> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  const fps = stream.getVideoTracks()[0]?.getSettings().frameRate ?? 30;
  const start = performance.now();
  async function* frames() {
    let i = 0;
    let last = -1;
    try {
      while (!signal.aborted) {
        await new Promise<void>((r) => ("requestVideoFrameCallback" in video ? video.requestVideoFrameCallback(() => r()) : requestAnimationFrame(() => r())));
        const t = performance.now() - start;
        if (t <= last) continue;
        last = t;
        yield { index: i++, timestampMs: t, image: await grab(video) };
      }
    } finally {
      video.pause();
      video.srcObject = null;
    }
  }
  return { kind: "camera", width: video.videoWidth, height: video.videoHeight, fps, frames: frames() };
}

/** A still photo as a one-frame source (posture check). Orientation from the photo's EXIF is applied. */
export async function imageSource(image: Blob): Promise<FrameSource> {
  const bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });
  const { width, height } = bitmap;
  async function* frames() {
    yield { index: 0, timestampMs: 0, image: bitmap };
  }
  return { kind: "upload", width, height, fps: 1, total: 1, frames: frames() };
}
