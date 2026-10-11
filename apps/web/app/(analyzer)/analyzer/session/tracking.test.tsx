import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { POSE_LANDMARK } from "@optimass/types";
import { squatSagittal2Reps } from "@optimass/types/fixtures";
import { FilmStep } from "./FilmStep";
import { frameAt } from "./PoseOverlay";
import { summarize } from "./use-pose-tracking";
import type { PoseTracking } from "./use-pose-tracking";

afterEach(cleanup);

const film = (tracking: PoseTracking, onRetry = vi.fn()) =>
  render(
    <FilmStep
      setNumber={1}
      video={{ url: "blob:set", name: "set.mp4" }}
      onVideo={() => {}}
      onDuration={() => {}}
      tracking={tracking}
      onRetryTracking={onRetry}
      onNext={() => {}}
      onSkipFeedback={() => {}}
    />,
  );

describe("tracking in the film step", () => {
  it("holds the next step while the video is being read", () => {
    film({ status: "running", progress: 0.42 });
    expect(screen.getByText("42%")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reading your movement…" })).toHaveProperty("disabled", true);
  });

  it("reports how well the body was tracked and which parts were hard to see", () => {
    film({ status: "done", sequence: squatSagittal2Reps, summary: { bodyFound: 0.96, hardToSee: [{ label: "wrist", seen: 0.6 }] } });
    expect(screen.getByText("Body tracked in 96% of the video")).toBeTruthy();
    expect(screen.getByText(/Your wrist was hard to see in 40% of the video/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next: how did it feel?" })).toHaveProperty("disabled", false);
  });

  it("lets the lifter retry or carry on when tracking fails", () => {
    const onRetry = vi.fn();
    film({ status: "failed", message: "No body was found in the video." }, onRetry);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Next: how did it feel?" })).toHaveProperty("disabled", false);
  });
});

describe("summarize", () => {
  it("counts the better-seen side of each part and flags parts seen too rarely", () => {
    const frames = squatSagittal2Reps.frames.slice(0, 10).map((f, i) => ({
      ...f,
      landmarks: f.landmarks.map((l, j) =>
        j === POSE_LANDMARK.left_wrist || j === POSE_LANDMARK.right_wrist ? { ...l, visibility: i < 5 ? 0.9 : 0.1 } : { ...l, visibility: 0.9 },
      ),
    }));
    expect(summarize({ frames }, 20)).toEqual({ bodyFound: 0.5, hardToSee: expect.arrayContaining([{ label: "wrist", seen: 0.25 }]) });
  });
});

describe("frameAt", () => {
  const frames = squatSagittal2Reps.frames;
  it("finds the frame nearest the playhead", () => {
    const f = frames[3]!;
    expect(frameAt(frames, f.timestampMs + 5)).toBe(f);
  });
  it("draws nothing far from any tracked frame", () => {
    expect(frameAt(frames, frames.at(-1)!.timestampMs + 1000)).toBeNull();
  });
});
