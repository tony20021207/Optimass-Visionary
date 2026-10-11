import type { RawPose } from "./frames";
import type { WorkerRequest, WorkerResponse } from "./protocol";

/** Finds one pose in an image. Timestamps must increase from call to call (MediaPipe VIDEO mode). */
export interface PoseDetector {
  detect(image: ImageBitmap, timestampMs: number): Promise<RawPose | null>;
  close(): void;
}

/** Starts the MediaPipe worker and resolves once the model is loaded. */
export async function createWorkerDetector(wasmBaseUrl: string, modelUrl: string): Promise<PoseDetector & { delegate: "GPU" | "CPU" }> {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "pose-landmarker" });
  const pending = new Map<number, { resolve: (p: RawPose | null) => void; reject: (e: Error) => void }>();
  let nextId = 0;

  const ready = new Promise<"GPU" | "CPU">((resolve, reject) => {
    worker.onerror = (e) => reject(new Error(e.message || "The pose worker failed to start"));
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "ready") resolve(msg.delegate);
      else if (msg.type === "result") {
        pending.get(msg.id)?.resolve(msg.pose);
        pending.delete(msg.id);
      } else if (msg.id === undefined) reject(new Error(msg.message));
      else {
        pending.get(msg.id)?.reject(new Error(msg.message));
        pending.delete(msg.id);
      }
    };
  });
  const post = (msg: WorkerRequest, transfer: Transferable[] = []) => worker.postMessage(msg, transfer);

  post({ type: "init", wasmBaseUrl: new URL(wasmBaseUrl, location.href).href, modelUrl });
  let delegate: "GPU" | "CPU";
  try {
    delegate = await ready;
  } catch (e) {
    worker.terminate();
    throw e;
  }

  return {
    delegate,
    detect(image, timestampMs) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        post({ type: "detect", id, image, timestampMs }, [image]);
      });
    },
    close() {
      post({ type: "close" });
      pending.forEach((p) => p.reject(new Error("Pose capture stopped")));
      pending.clear();
    },
  };
}
