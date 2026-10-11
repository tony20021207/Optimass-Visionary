import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { squatSagittal2Reps } from "@optimass/types/fixtures";
import { buildFormReport, formatLimit, formatValue, resultsForClaude, unitOf } from "./form-report";
import { FormCheck, Results } from "./FormCheck";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});
afterEach(cleanup);

const params = {
  version: "0.1.0-draft",
  reviewedBy: null,
  checks: [{ id: "trunk_stays_still", why: "Trunk shouldn't swing." }, { id: "full_stretch_at_top" }],
};
const check = (id: string, feature: string, value: number, status: "pass" | "fail" | "info", limits: { min?: number; max?: number } = {}) => ({
  id,
  feature,
  value,
  status,
  ...limits,
});
const report = {
  reps: [
    {
      rep: { repIndex: 0, startMs: 0, endMs: 3000 },
      checks: [
        check("full_stretch_at_top", "elbow_flexion_top_deg", 9, "pass", { max: 15 }),
        check("trunk_stays_still", "trunk_lean_range_deg", 31.2, "fail", { max: 24 }),
        check("concentric_time", "concentric_s", 1.234, "info"),
      ],
    },
    {
      rep: { repIndex: 1, startMs: 3000, endMs: 6000 },
      checks: [
        check("full_stretch_at_top", "elbow_flexion_top_deg", 10, "pass", { max: 15 }),
        check("trunk_stays_still", "trunk_lean_range_deg", 12, "pass", { max: 24 }),
        check("concentric_time", "concentric_s", Number.NaN, "info"),
      ],
    },
  ],
};

describe("form report", () => {
  const view = buildFormReport(report, params);

  it("lists each rep's failed checks first, with labels, units and the why from the parameter file", () => {
    expect(view.reps[0]!.fails).toBe(1);
    expect(view.reps[0]!.checks[0]).toMatchObject({ id: "trunk_stays_still", label: "Trunk stays still", unit: "°", why: "Trunk shouldn't swing." });
    expect(view.reps[1]!.startSec).toBe(3);
    expect(view.reviewed).toBe(false);
  });

  it("formats values and limits for reading", () => {
    expect(unitOf("wrist_peak_acc_x_arm")).toBe("arm lengths/s²");
    expect(unitOf("bar_bottom_rel_shoulder_x_arm")).toBe("arm lengths");
    expect(formatValue(31.24, "°")).toBe("31°");
    expect(formatValue(Number.NaN, "s")).toBe("not measurable");
    expect(formatLimit({ min: 10, max: 18, unit: "°" })).toBe("10° to 18°");
    expect(formatLimit({ max: 0.32, unit: "arm lengths" })).toBe("at most 0.32 arm lengths");
  });

  it("copies compact results for the Tier 1 thread", () => {
    const parsed = JSON.parse(resultsForClaude(view, "wide_overhand", { name: "set.mp4" }));
    expect(parsed.reps[0]).toMatchObject({ rep: 1, failed: ["trunk_stays_still"], values: { concentric_time: 1.234 } });
    expect(parsed.reps[1].values.concentric_time).toBeNull();
  });
});

describe("results screen", () => {
  const view = buildFormReport(report, params);
  const show = () =>
    render(
      <Results
        view={view}
        sequence={squatSagittal2Reps}
        videoUrl="blob:set"
        bodyFound={0.97}
        hardToSee={[]}
        showSkeleton={false}
        onShowSkeleton={vi.fn()}
        copyText={() => ""}
        onDownload={vi.fn()}
      />,
    );

  it("summarizes the set and shows the selected rep's errors", () => {
    show();
    expect(screen.getByRole("heading", { name: "2 reps · 1 form error" })).toBeTruthy();
    expect(screen.getByText("1 of 2 reps")).toBeTruthy();
    const errors = screen.getByRole("list", { name: "Form errors on rep 1" });
    expect(within(errors).getByText("Trunk stays still")).toBeTruthy();
    expect(within(errors).getByText("Limit: at most 24°")).toBeTruthy();
  });

  it("switches reps", () => {
    show();
    fireEvent.click(screen.getByRole("tab", { name: /Rep 2/ }));
    expect(screen.getByText("Every check passed on this rep.")).toBeTruthy();
  });
});

describe("language switch", () => {
  it("switches the page to Chinese", () => {
    render(<FormCheck variations={[{ id: "wide_overhand", label: "Wide overhand" }]} analyze={() => buildFormReport(report, params)} trackPose={false} />);
    fireEvent.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByRole("heading", { name: "动作检测 · 高位下拉" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "宽距正握" })).toBeTruthy();
    expect(screen.getByText("录制或选择视频")).toBeTruthy();
  });

  it("shows results in Chinese", () => {
    render(
      <Results
        view={buildFormReport(report, params)}
        sequence={squatSagittal2Reps}
        videoUrl="blob:set"
        bodyFound={0.97}
        hardToSee={[]}
        showSkeleton={false}
        onShowSkeleton={vi.fn()}
        copyText={() => ""}
        onDownload={vi.fn()}
        lang="zh"
      />,
    );
    expect(screen.getByRole("heading", { name: "2 次 · 1 个动作错误" })).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "第 1 次的动作错误" })).getByText("标准：不超过 24°")).toBeTruthy();
  });
});
