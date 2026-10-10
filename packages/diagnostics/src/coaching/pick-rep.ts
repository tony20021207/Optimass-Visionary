import type { KinematicFinding } from "@optimass/types";

export interface RepWindow {
  repIndex: number;
  startMs: number;
  endMs: number;
}

/**
 * Orders severities only. These are ranks for picking a rep, not clinical weights.
 * TODO(Tony): replace the findings-based score with each rep's distance from the model's ideal pulldown
 * (Motion Lab baseline) once Tier 1 reports it per rep.
 */
const SEVERITY_RANK = { minor: 1, moderate: 2, major: 3 } as const;

/**
 * Picks the rep closest to good form, for the lifter to review and mark what they felt.
 * Score per rep = sum of severity rank × confidence over the Tier 1 findings that include it; lowest wins.
 * Ties go to the rep nearest the middle of the set (away from the first rep and the most fatigued ones).
 */
export function pickReviewRep(reps: readonly RepWindow[], findings: readonly KinematicFinding[]): RepWindow | undefined {
  if (reps.length === 0) return undefined;
  const middle = (reps.length - 1) / 2;
  const scored = reps.map((rep, i) => ({
    rep,
    score: findings.reduce((s, f) => (f.repIndices.includes(rep.repIndex) ? s + SEVERITY_RANK[f.severity] * f.confidence : s), 0),
    offCentre: Math.abs(i - middle),
  }));
  scored.sort((a, b) => a.score - b.score || a.offCentre - b.offCentre || a.rep.repIndex - b.rep.repIndex);
  return scored[0]!.rep;
}
