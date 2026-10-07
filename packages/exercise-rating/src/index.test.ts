import { describe, expect, it } from "vitest";
import * as api from "./index";

describe("@optimass/exercise-rating stub", () => {
  it("exposes the planned public API", () => {
    expect(typeof api.loadRubric).toBe("function");
    expect(typeof api.rateExercise).toBe("function");
  });
});
