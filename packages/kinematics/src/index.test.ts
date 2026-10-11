import { describe, expect, it } from "vitest";
import * as api from "./index";

describe("@optimass/kinematics", () => {
  it("exposes the planned public API", () => {
    expect(typeof api.analyzeKinematics).toBe("function");
  });
});
