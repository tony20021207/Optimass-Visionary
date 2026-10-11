/// <reference lib="webworker" />
// Runs MediaPipe Pose Landmarker off the main thread. Messages are typed in ./protocol.
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const scope = self as unknown as DedicatedWorkerGlobalScope;
let landmarker: PoseLandmarker | null = null;

const reply = (msg: WorkerResponse) => scope.postMessage(msg);

async function init(wasmBaseUrl: string, modelUrl: string) {
  const fileset = await FilesetResolver.forVisionTasks(wasmBaseUrl);
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: modelUrl, delegate },
    runningMode: "VIDEO" as const,
    numPoses: 1,
  });
  // GPU needs OffscreenCanvas + WebGL in workers; older phones fall back to CPU.
  try {
    landmarker = await PoseLandmarker.createFromOptions(fileset, options("GPU"));
    return "GPU" as const;
  } catch {
    landmarker = await PoseLandmarker.createFromOptions(fileset, options("CPU"));
    return "CPU" as const;
  }
}

scope.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      const delegate = await init(msg.wasmBaseUrl, msg.modelUrl);
      reply({ type: "ready", delegate });
    } else if (msg.type === "detect") {
      if (!landmarker) throw new Error("Pose model isn't loaded yet");
      const result = landmarker.detectForVideo(msg.image, msg.timestampMs);
      msg.image.close();
      const landmarks = result.landmarks[0];
      const worldLandmarks = result.worldLandmarks[0];
      reply({ type: "result", id: msg.id, pose: landmarks && worldLandmarks ? { landmarks, worldLandmarks } : null });
    } else if (msg.type === "close") {
      landmarker?.close();
      landmarker = null;
      scope.close();
    }
  } catch (err) {
    if (msg.type === "detect") msg.image.close();
    reply({ type: "error", id: msg.type === "detect" ? msg.id : undefined, message: err instanceof Error ? err.message : String(err) });
  }
};
