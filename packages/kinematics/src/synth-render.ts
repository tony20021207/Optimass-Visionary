// Turns body-frame stick-figure poses into a MediaPipe-shaped PoseSequence as seen from a given camera placement.
// Shared by the synthetic exercise and posture clips. Synthetic data only: not recordings, not clinical references.
import { POSE_LANDMARK_NAMES, PoseSequence, type PoseLandmarkName } from "@optimass/types";
import { cameraBasis, cameraViewFor, toImageLandmark, toWorldLandmark, visibilityFor, type CameraPlacement } from "./camera";
import { add, scale, v, type Vec3 } from "./vec3";

/** A full 33-point pose in the body frame (x = lifter's left, y = up, z = forward, origin at the hip midpoint). */
export type Body = Record<PoseLandmarkName, Vec3>;

/** Depth (along the camera axis) noise relative to in-image noise. A guess: MediaPipe depth is the weakest axis. */
const DEPTH_NOISE_FACTOR = 2.5;

export const SYNTH_IMAGE = { width: 720, height: 1280 };

/** Which way each landmark's surface faces, for the visibility model. */
function surfaceNormal(name: PoseLandmarkName): Vec3 {
  if (/^(nose|mouth|left_eye|right_eye)/.test(name)) return v(0, 0, 1);
  if (name === "left_ear") return v(1, 0, 0.3);
  if (name === "right_ear") return v(-1, 0, 0.3);
  return name.startsWith("left_") ? v(1, 0, 0) : v(-1, 0, 0);
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

export interface RenderOptions {
  id: string;
  exerciseId: string;
  fps: number;
  frameCount: number;
  poseAtFrame: (frame: number) => Body;
  camera: CameraPlacement;
  /** Hip midpoint height above the floor in this exercise (seated ≈ 0.5, standing ≈ 0.9). */
  hipHeightM: number;
  /** Std. dev. of jitter added to world coordinates, mimicking estimation noise. */
  noiseM: number;
  seed: number;
}

export function renderSequence(o: RenderOptions): PoseSequence {
  const basis = cameraBasis(o.camera, o.hipHeightM);
  const rand = mulberry32(o.seed);
  const vis = POSE_LANDMARK_NAMES.map((n) => visibilityFor(surfaceNormal(n), basis));
  const frames = [];
  for (let i = 0; i < o.frameCount; i++) {
    const pose = o.poseAtFrame(i);
    const body = POSE_LANDMARK_NAMES.map((n) => {
      // Single-camera depth is the least certain axis, so jitter along the viewing direction is larger.
      const g = () => gaussian(rand) * o.noiseM;
      const jitter = add(add(scale(basis.right, g()), scale(basis.up, g())), scale(basis.look, g() * DEPTH_NOISE_FACTOR));
      return add(pose[n], jitter);
    });
    frames.push({
      frameIndex: i,
      timestampMs: Math.round((i * 1000) / o.fps),
      landmarks: body.map((p, k) => {
        const img = toImageLandmark(p, basis, SYNTH_IMAGE);
        return { x: r5(img.x), y: r5(img.y), z: r5(img.z), visibility: vis[k]! };
      }),
      worldLandmarks: body.map((p, k) => {
        const w = toWorldLandmark(p, basis);
        return { x: r5(w.x), y: r5(w.y), z: r5(w.z), visibility: vis[k]! };
      }),
    });
  }
  return PoseSequence.parse({
    id: o.id,
    exerciseId: o.exerciseId,
    cameraView: cameraViewFor(o.camera.azimuthDeg),
    fps: o.fps,
    image: SYNTH_IMAGE,
    source: "fixture",
    frames,
  });
}
