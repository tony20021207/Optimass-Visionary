import type { KinematicFinding } from "@optimass/types";
import { pulldownSagittalFindings } from "@optimass/diagnostics";

/**
 * Stand-in for real analysis. Pose capture (M4) and the Tier 1 pipeline aren't connected to the app yet,
 * so every set gets hand-written pulldown findings, fewer each set, so the loop can be tried end to end.
 */
export function analyzeSetDemo(setIndex: number): KinematicFinding[] {
  return pulldownSagittalFindings.slice(0, Math.max(0, pulldownSagittalFindings.length - setIndex));
}
