import { describe, expect, it } from "vitest";
import * as api from "./index";

describe("@optimass/diagnostics stub", () => {
  it("exposes the planned public API", () => {
    expect(typeof api.loadRuleSet).toBe("function");
    expect(typeof api.detectFindings).toBe("function");
    expect(typeof api.inferRootCauses).toBe("function");
    expect(typeof api.prescribeCorrectives).toBe("function");
    expect(typeof api.diagnose).toBe("function");
  });
});
