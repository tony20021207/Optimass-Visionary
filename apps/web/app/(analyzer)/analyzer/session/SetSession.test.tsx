import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { parseCoachingTable, parseTier2Rules } from "@optimass/diagnostics";
import { SetSession } from "./SetSession";

// Tests run with apps/web as the working directory, like the app.
const read = (rel: string) => readFileSync(path.resolve(process.cwd(), "../../content/rules", rel), "utf8");
const coaching = parseCoachingTable(read("coaching/lat_pulldown.yaml"));
const tier2 = parseTier2Rules([{ path: "lat_pulldown.yaml", text: read("tier2/lat_pulldown.yaml") }]);

beforeAll(() => {
  // jsdom has neither object URLs nor ResizeObserver.
  URL.createObjectURL = () => "blob:set";
  URL.revokeObjectURL = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});
afterEach(cleanup);

const renderSession = () => render(<SetSession exerciseLabel="Lat pulldown" coaching={coaching} tier2={tier2} totalSets={3} />);

const filmSet = () => {
  const input = screen.getByLabelText(/record or choose a video/i);
  fireEvent.change(input, { target: { files: [new File(["x"], "set.mp4", { type: "video/mp4" })] } });
};

describe("set session", () => {
  it("runs film → feedback → review and turns a low lat rating into a feel cue", () => {
    renderSession();
    expect(screen.getByRole("button", { name: /how did it feel/i })).toHaveProperty("disabled", true);

    filmSet();
    fireEvent.click(screen.getByRole("button", { name: /how did it feel/i }));

    fireEvent.click(screen.getByRole("button", { name: "Lats and teres major" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByRole("slider", { name: "How strongly did you feel Lats and teres major?" }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Any pain or discomfort?" })).getByRole("button", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: /see my cues/i }));

    expect(screen.getByText("Set 1: your feedback")).toBeTruthy();
    expect(screen.getByText("Arms don't reach full overhead extension at the top of the rep")).toBeTruthy();
    // Not marking an area counts as not feeling it.
    expect(screen.getAllByText(/You didn't feel rhomboids/).length).toBeGreaterThan(0);
    expect(screen.getByText(coaching.feel.muscles[0]!.lowCues[0]!)).toBeTruthy();
    expect(screen.getAllByText(/You rated lats and teres major 2\/10/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("takes three sets, with skipped feedback, to the summary", () => {
    renderSession();
    for (let n = 1; n <= 3; n++) {
      filmSet();
      fireEvent.click(screen.getByRole("button", { name: /skip feedback/i }));
      expect(screen.getByText(`Set ${n}: your feedback`)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: n < 3 ? `Film set ${n + 1}` : "Finish session" }));
    }
    expect(screen.getByText(/session done/i)).toBeTruthy();
  });
});
