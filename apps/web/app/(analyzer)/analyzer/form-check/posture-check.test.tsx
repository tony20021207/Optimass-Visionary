import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { standingFrontalStatic } from "@optimass/types/fixtures";
import type { AnalyzeBaseline } from "./baseline";
import { PostureCheck } from "./PostureCheck";

afterEach(cleanup);

const skeleton = {
  segments: { shoulder_width: { lengthM: 0.36, perView: {}, spread: 0 } },
  proportions: { upper_arm_m: 0.305, forearm_m: 0.262, trunk_m: 0.5, thigh_m: 0.42, shin_m: 0.4 },
  sideDifferenceM: { upper_arm: 0.006, forearm: -0.004, thigh: 0, shin: 0 },
  scale: 1,
};

describe("posture check", () => {
  it("takes the 4 photos after consent, measures, and saves the baseline", async () => {
    const analyze = vi.fn<AnalyzeBaseline>(() => ({
      heightCm: 178,
      skeleton,
      posture: [{ id: "head_forward", feature: "head_forward_deg", value: 14, max: 11, status: "fail" as const }],
    }));
    const onSaved = vi.fn();
    render(<PostureCheck lang="en" analyze={analyze} onSaved={onSaved} onCancel={() => {}} readPhoto={async () => standingFrontalStatic} />);

    expect(screen.getByRole("button", { name: "Begin" })).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText(/Your height/), { target: { value: "178" } });
    fireEvent.click(screen.getByLabelText("I understand and want to take the photos"));
    fireEvent.click(screen.getByRole("button", { name: "Begin" }));

    for (const name of ["Front", "Back", "Left side", "Right side"]) {
      fireEvent.change(screen.getByLabelText(`Take photo: ${name}`), { target: { files: [new File(["x"], "p.jpg", { type: "image/jpeg" })] } });
    }
    await waitFor(() => expect(screen.getAllByText("✓ Body found")).toHaveLength(4));
    fireEvent.click(screen.getByRole("button", { name: "See my results" }));

    expect(analyze).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ view: "posterior" })]), 178);
    expect(screen.getByText("30.5 cm")).toBeTruthy();
    expect(screen.getByText("Head over the shoulders")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save as my baseline" }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ version: 1, heightCm: 178 }));
  });
});
