// Rep segmentation for a vertical pull, driven by bar height (wrist midpoint above the shoulders).
import { RepSegment } from "@optimass/types";
import type { KinematicSeries } from "../index";
import { max, min } from "../signal";

/**
 * Segmentation tuning. These decide where a phase starts and stops in the signal; they are signal-processing
 * choices, not clinical thresholds. Bands are fractions of the clip's total bar travel.
 */
export const SEGMENT_TUNING = {
  /** Bar must travel at least this far (m) for the clip to contain reps at all. */
  minTravelM: 0.15,
  /** Within this fraction of the top of travel counts as "at the top" (arms overhead). */
  topBand: 0.05,
  /** Within this fraction of the bottom of travel counts as "at the bottom" (bar at the chest). */
  bottomBand: 0.05,
};

/**
 * Splits a pulldown clip into reps. A pulldown starts at the top, so each rep runs
 * concentric (bar comes down) → bottom_pause → eccentric (bar goes back up) → lockout (arms overhead again).
 * A rep that never reaches the bottom band, or never returns to the top band, is not counted.
 */
export function segmentPulldownReps(series: KinematicSeries, tuning = SEGMENT_TUNING): RepSegment[] {
  const h = series.metrics.wrist_mid_height_m ?? [];
  const t = series.timestampsMs;
  if (h.length < 3) return [];
  const lo = min(h);
  const hi = max(h);
  const travel = hi - lo;
  if (!(travel >= tuning.minTravelM)) return [];
  const pos = h.map((x) => (x - lo) / travel); // 1 = top, 0 = bottom
  const atTop = (i: number) => pos[i]! >= 1 - tuning.topBand;
  const atBottom = (i: number) => pos[i]! <= tuning.bottomBand;

  const reps: RepSegment[] = [];
  let i = 0;
  const n = h.length;
  while (i < n) {
    // Find the last top frame before the bar starts down.
    while (i < n && !atTop(i)) i++;
    while (i + 1 < n && atTop(i + 1)) i++;
    if (i >= n - 1) break;
    const start = i;
    let j = start + 1;
    while (j < n && !atBottom(j) && !atTop(j)) j++;
    if (j >= n) break;
    if (atTop(j)) {
      i = j; // aborted pull: bar came back up without reaching the bottom
      continue;
    }
    const bottomStart = j;
    while (j + 1 < n && atBottom(j + 1)) j++;
    const bottomEnd = j;
    while (j < n && !atTop(j)) j++;
    if (j >= n) break; // never returned to the top
    const topReturn = j;
    while (j + 1 < n && atTop(j + 1)) j++;
    const end = j;

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
    // The next rep may start from this rep's last top frame.
    i = end;
  }
  return reps;
}
