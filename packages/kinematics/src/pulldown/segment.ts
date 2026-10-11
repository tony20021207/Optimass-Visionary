// Rep segmentation for a vertical pull, driven by bar height (wrist midpoint above the shoulders).
import { RepSegment } from "@optimass/types";
import type { KinematicSeries } from "../index";
import { max, min } from "../signal";

/**
 * Segmentation tuning. These decide where a phase starts and stops in the signal; they are signal-processing
 * choices, not clinical thresholds.
 */
export const SEGMENT_TUNING = {
  /** Bar must travel at least this far (m) in a rep for it to count. */
  minTravelM: 0.15,
  /**
   * Hysteresis for finding reps, as fractions of the clip's whole bar travel: the bar is "up" once above `upAt` and
   * stays up until it drops below `downAt`, and vice versa. Wide enough that the top drifting a few cm between reps
   * (or the clip starting or ending with the arms at a different height) does not lose a rep.
   */
  upAt: 0.65,
  downAt: 0.35,
  /** Within this fraction of the rep's own travel from its top counts as "at the top" (arms overhead). */
  topBand: 0.05,
  /** Within this fraction of the rep's own travel from its bottom counts as "at the bottom" (bar at the chest). */
  bottomBand: 0.05,
};

/**
 * Splits a pulldown clip into reps. A pulldown starts at the top, so each rep runs
 * concentric (bar comes down) → bottom_pause → eccentric (bar goes back up) → lockout (arms overhead again).
 * Reps are found as up → down → up swings of the bar (with hysteresis), then each rep's top and bottom are judged
 * against that rep's own highest and lowest bar height, not the clip's, so drift between reps doesn't matter.
 * A rep that never reaches the bottom, or never returns to the top, is not counted.
 */
export function segmentPulldownReps(series: KinematicSeries, tuning = SEGMENT_TUNING): RepSegment[] {
  const h = series.metrics.wrist_mid_height_m ?? [];
  const t = series.timestampsMs;
  const n = h.length;
  if (n < 3) return [];
  const lo = min(h);
  const hi = max(h);
  const travel = hi - lo;
  if (!(travel >= tuning.minTravelM)) return [];

  // Up / down runs with hysteresis (frames before the bar first goes clearly up or down belong to no run).
  const runs: { up: boolean; from: number; to: number }[] = [];
  let state: boolean | undefined;
  for (let i = 0; i < n; i++) {
    const pos = (h[i]! - lo) / travel;
    const next = pos >= tuning.upAt ? true : pos <= tuning.downAt ? false : state;
    if (next === undefined) continue;
    if (next !== state || !runs.length) runs.push({ up: next, from: i, to: i });
    else runs[runs.length - 1]!.to = i;
    state = next;
  }

  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
  const reps: RepSegment[] = [];
  for (let r = 0; r + 2 < runs.length; r++) {
    const [upA, down, upB] = [runs[r]!, runs[r + 1]!, runs[r + 2]!];
    if (!upA.up || down.up || !upB.up) continue;
    const topA = max(h.slice(upA.from, upA.to + 1));
    const bottom = min(h.slice(down.from, down.to + 1));
    const topB = max(h.slice(upB.from, upB.to + 1));
    if (!(topA - bottom >= tuning.minTravelM && topB - bottom >= tuning.minTravelM)) continue;
    const nearTopA = (i: number) => h[i]! >= topA - tuning.topBand * (topA - bottom);
    const nearTopB = (i: number) => h[i]! >= topB - tuning.topBand * (topB - bottom);
    const nearBottom = (i: number) => h[i]! <= bottom + tuning.bottomBand * (topA - bottom);
    // Last frame at the top before the bar starts down; first and last frames at the bottom; back at the top.
    const start = range(upA.from, upA.to).filter(nearTopA).pop()!;
    const atBottom = range(start, down.to).filter(nearBottom);
    const bottomStart = atBottom[0]!;
    const bottomEnd = atBottom[atBottom.length - 1]!;
    const backAtTop = range(upB.from, upB.to).filter(nearTopB);
    const topReturn = backAtTop[0]!;
    // The lockout lasts until the next rep leaves the top (that rep starts from this frame).
    const end = backAtTop[backAtTop.length - 1]!;

    const ms = (k: number) => t[k]!;
    const romDeg: Record<string, { min: number; max: number }> = {};
    for (const name of ["left_elbow_flexion", "right_elbow_flexion", "left_humerothoracic_elevation", "right_humerothoracic_elevation"]) {
      const s = (series.metrics[`${name}_deg`] ?? []).slice(start, end + 1);
      if (s.length) romDeg[name] = { min: min(s), max: max(s) };
    }
    reps.push(
      RepSegment.parse({
        repIndex: reps.length,
        side: "bilateral",
        startMs: ms(start),
        endMs: ms(end),
        startFrame: start,
        endFrame: end,
        phases: [
          { phase: "concentric", startMs: ms(start), endMs: ms(bottomStart) },
          { phase: "bottom_pause", startMs: ms(bottomStart), endMs: ms(bottomEnd) },
          { phase: "eccentric", startMs: ms(bottomEnd), endMs: ms(topReturn) },
          { phase: "lockout", startMs: ms(topReturn), endMs: ms(end) },
        ],
        romDeg,
      }),
    );
  }
  return reps;
}
