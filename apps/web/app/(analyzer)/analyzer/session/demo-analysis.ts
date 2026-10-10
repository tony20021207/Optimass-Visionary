import type { KinematicFinding } from "@optimass/types";
import { pickReviewRep, pulldownSagittalFindings } from "@optimass/diagnostics";
import type { RomPhase } from "@optimass/diagnostics";
import type { RepClip, VideoClip } from "./RepVideo";

/** Reps assumed in a demo set. Real rep boundaries will come from pose capture. */
const DEMO_REPS = 5;
/** Share of a demo rep spent pulling down; the rest is the return. Real phases will come from Tier 1. */
const DEMO_PULL_SHARE = 0.4;

export const PHASES: { id: RomPhase; label: string }[] = [
  { id: "first_third", label: "First third of the pull" },
  { id: "middle_third", label: "Middle third" },
  { id: "last_third", label: "Last third, down to the bottom" },
];

export interface PhaseClip extends VideoClip {
  phase: RomPhase;
}

export interface SetAnalysis {
  findings: KinematicFinding[];
  repCount: number;
  /** The rep closest to good form, or null when the video's length is unknown. */
  reviewRep: RepClip | null;
  /** That rep cut into thirds of the range, or null with no rep (the lifter then reviews the whole set). */
  phaseClips: PhaseClip[] | null;
}

/**
 * Cuts a rep into thirds of the range by time: each third gets its stretch of the pull and its stretch of the
 * return. Tier 1 will replace this with position-based boundaries (top, 1/3, 2/3, bottom keyframes).
 */
export function demoPhaseClips(rep: RepClip): PhaseClip[] {
  const bottom = rep.startSec + (rep.endSec - rep.startSec) * DEMO_PULL_SHARE;
  const down = (bottom - rep.startSec) / 3;
  const up = (rep.endSec - bottom) / 3;
  const third = (i: number) => ({
    // Down through third i, then back up through it (the return passes the thirds in reverse order).
    down: { startSec: rep.startSec + i * down, endSec: rep.startSec + (i + 1) * down },
    up: { startSec: bottom + (2 - i) * up, endSec: bottom + (3 - i) * up },
  });
  return PHASES.map(({ id, label }, i) => {
    const t = third(i);
    // The last third runs straight through the bottom, so its two stretches join into one.
    const windows = i === 2 ? [{ startSec: t.down.startSec, endSec: t.up.endSec }] : [t.down, t.up];
    return { phase: id, label: `Rep ${rep.repIndex + 1}, ${label.toLowerCase()}`, windows };
  });
}

/**
 * Stand-in for real analysis. Pose capture (M4) and the Tier 1 pipeline aren't connected to the app yet,
 * so every set gets hand-written pulldown findings, fewer each set, and the video is cut into equal reps.
 */
export function analyzeSetDemo(setIndex: number, durationSec?: number): SetAnalysis {
  const findings = pulldownSagittalFindings.slice(0, Math.max(0, pulldownSagittalFindings.length - setIndex));
  if (!durationSec || !Number.isFinite(durationSec)) return { findings, repCount: DEMO_REPS, reviewRep: null, phaseClips: null };
  const repMs = (durationSec * 1000) / DEMO_REPS;
  const reps = Array.from({ length: DEMO_REPS }, (_, i) => ({ repIndex: i, startMs: i * repMs, endMs: (i + 1) * repMs }));
  const best = pickReviewRep(reps, findings);
  const reviewRep = best ? { repIndex: best.repIndex, startSec: best.startMs / 1000, endSec: best.endMs / 1000 } : null;
  return { findings, repCount: DEMO_REPS, reviewRep, phaseClips: reviewRep ? demoPhaseClips(reviewRep) : null };
}
