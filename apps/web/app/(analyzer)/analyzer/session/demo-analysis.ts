import type { KinematicFinding } from "@optimass/types";
import { pickReviewRep, pulldownSagittalFindings } from "@optimass/diagnostics";
import type { CoachingPhase } from "@optimass/diagnostics";
import type { RepClip, VideoClip } from "./RepVideo";

/** Reps assumed in a demo set. Real rep boundaries will come from pose capture. */
const DEMO_REPS = 5;
/** Share of a demo rep spent pulling down; the rest is the return. Real timings will come from Tier 1. */
const DEMO_PULL_SHARE = 0.4;

export interface PhaseClip extends VideoClip {
  phase: string;
  /** Position in the list of phases, from 1. */
  number: number;
  title: string;
}

export interface SetAnalysis {
  findings: KinematicFinding[];
  repCount: number;
  /** The rep closest to good form, or null when the video's length is unknown. */
  reviewRep: RepClip | null;
  /** That rep cut into the exercise's phases, or null with no rep (the lifter then reviews the whole set). */
  phaseClips: PhaseClip[] | null;
}

/**
 * Cuts a rep into the exercise's phases. Each phase gets its stretch of the pull, at the break points in the
 * coaching file, and the matching stretch of the return, which passes the phases in reverse.
 */
export function phaseClips(rep: RepClip, phases: readonly CoachingPhase[], pullShare = DEMO_PULL_SHARE): PhaseClip[] {
  const bottom = rep.startSec + (rep.endSec - rep.startSec) * pullShare;
  const down = bottom - rep.startSec;
  const up = rep.endSec - bottom;
  return phases.map((p, i) => {
    const from = i === 0 ? 0 : phases[i - 1]!.endsAt;
    const pull = { startSec: rep.startSec + from * down, endSec: rep.startSec + p.endsAt * down };
    const back = { startSec: rep.endSec - p.endsAt * up, endSec: rep.endSec - from * up };
    // The last phase runs straight through the bottom, so its two stretches join into one.
    const windows = p.endsAt === 1 ? [{ startSec: pull.startSec, endSec: back.endSec }] : [pull, back];
    return { phase: p.id, number: i + 1, title: p.label, label: `Rep ${rep.repIndex + 1}, ${p.label.toLowerCase()}`, windows };
  });
}

/**
 * Stand-in for real analysis. Pose capture (M4) and the Tier 1 pipeline aren't connected to the app yet,
 * so every set gets hand-written pulldown findings, fewer each set, and the video is cut into equal reps.
 */
export function analyzeSetDemo(setIndex: number, phases: readonly CoachingPhase[], durationSec?: number): SetAnalysis {
  const findings = pulldownSagittalFindings.slice(0, Math.max(0, pulldownSagittalFindings.length - setIndex));
  if (!durationSec || !Number.isFinite(durationSec)) return { findings, repCount: DEMO_REPS, reviewRep: null, phaseClips: null };
  const repMs = (durationSec * 1000) / DEMO_REPS;
  const reps = Array.from({ length: DEMO_REPS }, (_, i) => ({ repIndex: i, startMs: i * repMs, endMs: (i + 1) * repMs }));
  const best = pickReviewRep(reps, findings);
  const reviewRep = best ? { repIndex: best.repIndex, startSec: best.startMs / 1000, endSec: best.endMs / 1000 } : null;
  return { findings, repCount: DEMO_REPS, reviewRep, phaseClips: reviewRep ? phaseClips(reviewRep, phases) : null };
}
