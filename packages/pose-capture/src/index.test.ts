import { describe, expect, it } from "vitest";
import * as api from "./index";

describe("@optimass/pose-capture stub", () => {
  it("exposes the planned public API", () => {
    expect(typeof api.createPoseCapture).toBe("function");
  });
});
