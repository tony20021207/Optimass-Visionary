import { describe, expect, it } from "vitest";
import { analyzeSetDemo, phaseClips } from "./demo-analysis";
import { clipTime } from "./RepVideo";

const thirds = [
  { id: "first_third", label: "First third", endsAt: 1 / 3 },
  { id: "middle_third", label: "Middle third", endsAt: 2 / 3 },
  { id: "last_third", label: "Last third", endsAt: 1 },
];

describe("phaseClips", () => {
  // A 10 s rep: pull 0-4 s, return 4-10 s.
  const clips = phaseClips({ repIndex: 0, startSec: 0, endSec: 10 }, thirds);
  const windows = (i: number) => clips[i]!.windows.map((w) => [+w.startSec.toFixed(2), +w.endSec.toFixed(2)]);

  it("gives each third its stretch of the pull and of the return", () => {
    expect(clips.map((c) => c.phase)).toEqual(["first_third", "middle_third", "last_third"]);
    expect(windows(0)).toEqual([
      [0, 1.33],
      [8, 10],
    ]);
    expect(windows(1)).toEqual([
      [1.33, 2.67],
      [6, 8],
    ]);
    // The last third runs through the bottom in one stretch.
    expect(windows(2)).toEqual([[2.67, 6]]);
  });

  it("uses custom break points", () => {
    const two = phaseClips({ repIndex: 0, startSec: 0, endSec: 10 }, [
      { id: "off_floor", label: "Off the floor", endsAt: 0.25 },
      { id: "to_lockout", label: "To lockout", endsAt: 1 },
    ]);
    expect(two[0]!.windows.map((w) => [w.startSec, w.endSec])).toEqual([
      [0, 1],
      [8.5, 10],
    ]);
    expect(two[1]!.windows.map((w) => [w.startSec, w.endSec])).toEqual([[1, 8.5]]);
  });

  it("cuts the chosen rep from a demo set", () => {
    const a = analyzeSetDemo(0, thirds, 6);
    expect(a.reviewRep?.repIndex).toBe(3);
    expect(a.phaseClips?.[0]!.windows[0]!.startSec).toBeCloseTo(3.6);
    expect(analyzeSetDemo(0, thirds, Infinity).phaseClips).toBeNull();
  });
});

describe("clipTime", () => {
  const w = [
    { startSec: 0, endSec: 1 },
    { startSec: 8, endSec: 10 },
  ];
  it("leaves the time alone inside a window", () => expect(clipTime(w, 0.5)).toBe(0.5));
  it("moves on to the next window when one ends", () => expect(clipTime(w, 1.1)).toBe(8));
  it("loops back after the last window", () => expect(clipTime(w, 10.1)).toBe(0));
  it("snaps back to the start when scrubbed outside", () => expect(clipTime(w, 5)).toBe(0));
  it("does nothing without windows", () => expect(clipTime([], 5)).toBe(5));
});
