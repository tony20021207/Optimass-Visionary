import { describe, expect, it } from "vitest";
import * as api from "./index";

describe("@optimass/program-builder stub", () => {
  it("exposes the planned public API", () => {
    expect(typeof api.buildProgram).toBe("function");
  });
});
