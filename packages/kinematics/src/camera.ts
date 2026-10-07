// Where the camera sits relative to the lifter, and how a body-frame point maps to MediaPipe's outputs.
import type { CameraView } from "@optimass/types";
import protocolJson from "./capture-protocol.json";
import { add, cross, dot, scale, sub, unit, v, type Vec3 } from "./vec3";

export const CAPTURE_PROTOCOL = protocolJson;

/**
 * Camera position around the lifter. Body frame: x = lifter's left, y = up, z = the way the lifter faces,
 * origin at the hip midpoint.
 */
export interface CameraPlacement {
  /** 0 = straight in front, 90 = lifter's left side, 180 = behind, 135 = behind-left. */
  azimuthDeg: number;
  /** Lens height above the floor. */
  heightM: number;
  distanceM: number;
}

const rad = (d: number) => (d * Math.PI) / 180;
const UP = v(0, 1, 0);

export interface CameraBasis {
  /** Body-frame camera position. */
  position: Vec3;
  /** Unit vectors in the body frame: image right, world up, and the viewing direction (into the scene). */
  right: Vec3;
  up: Vec3;
  look: Vec3;
}

/** `hipHeightM` is the hip midpoint's height above the floor, so the camera height can be placed in the body frame. */
export function cameraBasis(cam: CameraPlacement, hipHeightM: number): CameraBasis {
  const toCamera = v(Math.sin(rad(cam.azimuthDeg)), 0, Math.cos(rad(cam.azimuthDeg)));
  const look = scale(toCamera, -1); // level camera aimed at the lifter
  return {
    position: add(scale(toCamera, cam.distanceM), v(0, cam.heightM - hipHeightM, 0)),
    right: unit(cross(look, UP)),
    up: UP,
    look,
  };
}

/** MediaPipe world landmark axes: x = image right, y = down, z = away from the camera; origin stays at the hips. */
export function toWorldLandmark(p: Vec3, basis: CameraBasis): Vec3 {
  return v(dot(p, basis.right), -dot(p, basis.up), dot(p, basis.look));
}

/** Pinhole projection to MediaPipe's normalized image landmarks for a portrait phone (protocol's vertical field of view). */
export function toImageLandmark(p: Vec3, basis: CameraBasis, image: { width: number; height: number }): Vec3 {
  const fy = 0.5 / Math.tan(rad(CAPTURE_PROTOCOL.phone.verticalFovDeg / 2));
  const fx = fy * (image.height / image.width);
  const rel = sub(p, basis.position);
  const depth = Math.max(0.1, dot(rel, basis.look));
  const hipDepth = Math.max(0.1, dot(scale(basis.position, -1), basis.look));
  return v(0.5 + (fx * dot(rel, basis.right)) / depth, 0.5 - (fy * dot(rel, basis.up)) / depth, (fx * (depth - hipDepth)) / hipDepth);
}

/** Rough visibility: high when the landmark's surface faces the camera, low when the body hides it. */
export function visibilityFor(surfaceNormal: Vec3, basis: CameraBasis): number {
  const facing = dot(unit(surfaceNormal), scale(basis.look, -1));
  return Math.round(Math.min(0.98, Math.max(0.1, 0.6 + 0.38 * facing)) * 100) / 100;
}

/**
 * The CameraView value a clip from this placement is tagged with.
 * TODO(contracts): CameraView in @optimass/types has no oblique value yet, so 45° clips are tagged "sagittal" until
 * "posterolateral" is added on main (needs Tony's go-ahead: it also touches the camera_view DB enum).
 */
export function cameraViewFor(azimuthDeg: number): CameraView {
  const a = ((azimuthDeg % 360) + 360) % 360;
  const off = (target: number) => Math.min(Math.abs(a - target), 360 - Math.abs(a - target));
  if (off(0) <= 20 || off(180) <= 20) return "frontal";
  return "sagittal";
}

/** Where the standard 45° exercise camera goes for a lifter whose hips are `hipHeightM` off the floor. */
export function standardExerciseCamera(waistHeightM: number, distanceM = 3): CameraPlacement {
  return { azimuthDeg: CAPTURE_PROTOCOL.exercise.azimuthDeg, heightM: waistHeightM, distanceM };
}
