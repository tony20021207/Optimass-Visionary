import type { RawPose } from "./frames";

export type WorkerRequest =
  | { type: "init"; wasmBaseUrl: string; modelUrl: string }
  | { type: "detect"; id: number; image: ImageBitmap; timestampMs: number }
  | { type: "close" };

export type WorkerResponse =
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "result"; id: number; pose: RawPose | null }
  | { type: "error"; id?: number; message: string };
