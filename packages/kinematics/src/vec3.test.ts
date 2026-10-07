import { describe, expect, it } from "vitest";
import { derivative, smooth } from "./signal";
import { angleBetweenDeg, jointAngleDeg, v } from "./vec3";

describe("vector math", () => {
  it("measures joint angles in 3D", () => {
    expect(jointAngleDeg(v(1, 0, 0), v(0, 0, 0), v(0, 1, 0))).toBeCloseTo(90);
    expect(jointAngleDeg(v(1, 0, 0), v(0, 0, 0), v(-1, 0, 0))).toBeCloseTo(180);
    expect(jointAngleDeg(v(1, 0, 0), v(0, 0, 0), v(1, 0, 1))).toBeCloseTo(45);
    expect(angleBetweenDeg(v(0, 0, 0), v(1, 0, 0))).toBeNaN();
  });

  it("differentiates and smooths series", () => {
    const t = [0, 100, 200, 300];
    expect(derivative([0, 1, 2, 3], t)).toEqual([10, 10, 10, 10]);
    expect(smooth([0, 0, 3, 0, 0], 3)).toEqual([0, 1, 1, 1, 0]);
  });
});
