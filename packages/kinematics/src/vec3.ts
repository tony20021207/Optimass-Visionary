// Small 3D vector helpers for MediaPipe world landmarks (meters, origin at the hip midpoint, y points down).

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => v(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const norm = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
export const dist = (a: Vec3, b: Vec3): number => norm(sub(a, b));
export const mid = (a: Vec3, b: Vec3): Vec3 => scale(add(a, b), 0.5);

export function unit(a: Vec3): Vec3 {
  const n = norm(a);
  return n === 0 ? v(0, 0, 0) : scale(a, 1 / n);
}

export const RAD_TO_DEG = 180 / Math.PI;

/** Unsigned angle between two vectors, in degrees (0..180). */
export function angleBetweenDeg(a: Vec3, b: Vec3): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return Number.NaN;
  const c = Math.min(1, Math.max(-1, dot(a, b) / (na * nb)));
  return Math.acos(c) * RAD_TO_DEG;
}

/** Interior angle at `b` formed by the points a–b–c, in degrees (180 = straight line). */
export function jointAngleDeg(a: Vec3, b: Vec3, c: Vec3): number {
  return angleBetweenDeg(sub(a, b), sub(c, b));
}

/** Removes the component of `a` along `axis` (axis need not be unit length). */
export function rejectFrom(a: Vec3, axis: Vec3): Vec3 {
  const u = unit(axis);
  return sub(a, scale(u, dot(a, u)));
}
