import { describe, expect, it } from "vitest";
import { pulldownSagittalFindings } from "../tier2/fixtures";
import { pickReviewRep } from "./pick-rep";

const reps = (n: number) => Array.from({ length: n }, (_, i) => ({ repIndex: i, startMs: i * 3000, endMs: (i + 1) * 3000 }));

describe("pickReviewRep", () => {
  it("returns undefined when there are no reps", () => {
    expect(pickReviewRep([], pulldownSagittalFindings)).toBeUndefined();
  });

  it("picks a rep with no findings, nearest the middle of the set", () => {
    // Findings cover reps 0-2; reps 3 and 4 are clean, and 3 is closer to the middle.
    expect(pickReviewRep(reps(5), pulldownSagittalFindings)?.repIndex).toBe(3);
  });

  it("picks the least severe rep when every rep has findings", () => {
    // Rep 0: lumbar (moderate 0.8) = 1.6. Rep 1: + top ROM (minor 0.7) = 2.3. Rep 2: + lean (minor 0.6) = 2.9.
    expect(pickReviewRep(reps(3), pulldownSagittalFindings)?.repIndex).toBe(0);
  });

  it("picks the middle rep when there are no findings", () => {
    expect(pickReviewRep(reps(5), [])?.repIndex).toBe(2);
  });
});
