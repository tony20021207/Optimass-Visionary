import type { KinematicFinding } from "@optimass/types";
import { pickReviewRep, pulldownSagittalFindings } from "@optimass/diagnostics";
import type { RepClip } from "./RepVideo";

/** Reps assumed in a demo set. Real rep boundaries will come from pose capture. */
const DEMO_REPS = 5;

export interface SetAnalysis {
  findings: KinematicFinding[];
  repCount: number;
  /** The rep closest to good form, or null when the video's length is unknown. */
  reviewRep: RepClip | null;
}

/**
 * Stand-in for real analysis. Pose capture (M4) and the Tier 1 pipeline aren't connected to the app yet,
 * so every set gets hand-written pulldown findings, fewer each set, and the video is cut into equal reps.
 */
export function analyzeSetDemo(setIndex: number, durationSec?: number): SetAnalysis {
  const findings = pulldownSagittalFindings.slice(0, Math.max(0, pulldownSagittalFindings.length - setIndex));
  if (!durationSec || !Number.isFinite(durationSec)) return { findings, repCount: DEMO_REPS, reviewRep: null };
  const repMs = (durationSec * 1000) / DEMO_REPS;
  const reps = Array.from({ length: DEMO_REPS }, (_, i) => ({ repIndex: i, startMs: i * repMs, endMs: (i + 1) * repMs }));
  const best = pickReviewRep(reps, findings);
  return {
    findings,
    repCount: DEMO_REPS,
    reviewRep: best ? { repIndex: best.repIndex, startSec: best.startMs / 1000, endSec: best.endMs / 1000 } : null,
  };
}
