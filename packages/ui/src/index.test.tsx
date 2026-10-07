import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button, Card, Panel, cn } from "./index";

afterEach(cleanup);

describe("ui primitives", () => {
  it("cn drops falsy classes", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("renders a button that defaults to type=button", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("button");
  });

  it("renders card and panel headings", () => {
    render(
      <Card title="Program">
        <Panel heading="Tier 1">body</Panel>
      </Card>,
    );
    expect(screen.getByRole("heading", { name: "Program" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tier 1" })).toBeTruthy();
  });
});
