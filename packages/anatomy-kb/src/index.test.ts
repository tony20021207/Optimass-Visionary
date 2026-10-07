import { describe, expect, it } from "vitest";
import * as api from "./index";

describe("@optimass/anatomy-kb stub", () => {
  it("exposes the planned public API", () => {
    expect(typeof api.loadAnatomyKb).toBe("function");
    expect(typeof api.musclesActingOn).toBe("function");
    expect(typeof api.romNorm).toBe("function");
  });
});
