import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "./nav";

describe("nav", () => {
  it("links each route group", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(["/planner", "/analyzer", "/account"]);
  });
});
