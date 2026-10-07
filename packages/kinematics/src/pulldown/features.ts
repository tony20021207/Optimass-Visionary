// Per-rep summary numbers ("features") for a pulldown. Still no judgement: evaluate.ts compares them to the
// editable parameter file.
import type { RepSegment } from "@optimass/types";
import type { KinematicSeries } from "../index";
import { max, mean, min } from "../signal";

export const PULLDOWN_FEATURES = {
  elbow_flexion_top_deg: "Elbow flexion at the top (smallest in the rep, mean of both arms)",
  elbow_flexion_peak_deg: "Elbow flexion at the bottom (largest in the rep, mean of both arms)",
  humerothoracic_elevation_top_deg: "Upper arm vs trunk at the top (largest, mean of both arms)",
  humerothoracic_elevation_bottom_deg: "Upper arm vs trunk at the bottom (smallest, mean of both arms)",
  bar_bottom_rel_shoulder_m: "Lowest wrist-midpoint height relative to the shoulders",
  trunk_lean_mean_deg: "Average trunk lean back from vertical",
  trunk_lean_range_deg: "How much the trunk lean changes within the rep",
  trunk_lean_peak_vel_dps: "Fastest trunk rocking (absolute angular velocity)",
  shoulder_depression_ratio: "Ear-to-shoulder gap gained from top to bottom, in shoulder widths (positive = depressed)",
  head_forward_change_m: "How far the ears move forward of the trunk line during the rep (m)",
  concentric_s: "Time to pull the bar down (5%–95% of travel)",
  bottom_pause_s: "Time held at the bottom",
  eccentric_s: "Time to return the bar to the top (95%–5% of travel)",
  wrist_height_asymmetry_m: "Largest left-right wrist height difference (bar tilt)",
  elbow_flexion_asymmetry_deg: "Left-right elbow flexion difference, averaged over the bottom of the rep",
  peak_wrist_speed_mps: "Fastest wrist speed during the pull",
  peak_elbow_flexion_vel_dps: "Fastest elbow flexion during the pull",
} as const;
export type PulldownFeature = keyof typeof PULLDOWN_FEATURES;
export type PulldownFeatures = Record<PulldownFeature, number>;

const phase = (rep: RepSegment, name: string) => rep.phases.find((p) => p.phase === name)!;
const seconds = (p: { startMs: number; endMs: number }) => (p.endMs - p.startMs) / 1000;

export function pulldownFeatures(series: KinematicSeries, rep: RepSegment): PulldownFeatures {
  const m = (name: string, from = rep.startFrame, to = rep.endFrame) => (series.metrics[name] ?? []).slice(from, to + 1);
  const t = series.timestampsMs;
  const frameAt = (ms: number) => Math.max(0, t.findIndex((x) => x >= ms));
  const concentric = phase(rep, "concentric");
  const bottom = phase(rep, "bottom_pause");
  const cFrom = frameAt(concentric.startMs);
  const cTo = frameAt(concentric.endMs);
  const both = (stat: (xs: number[]) => number, name: string) => mean([stat(m(`left_${name}`)), stat(m(`right_${name}`))]);

  const height = m("wrist_mid_height_m");
  const bottomFrame = rep.startFrame + height.indexOf(min(height));
  const gapChange = (side: "left" | "right") => {
    const gap = series.metrics[`${side}_shoulder_ear_gap_ratio`]!;
    return gap[bottomFrame]! - gap[rep.startFrame]!;
  };
  const lean = m("trunk_lean_deg");

  return {
    elbow_flexion_top_deg: both(min, "elbow_flexion_deg"),
    elbow_flexion_peak_deg: both(max, "elbow_flexion_deg"),
    humerothoracic_elevation_top_deg: both(max, "humerothoracic_elevation_deg"),
    humerothoracic_elevation_bottom_deg: both(min, "humerothoracic_elevation_deg"),
    bar_bottom_rel_shoulder_m: min(height),
    trunk_lean_mean_deg: mean(lean),
    trunk_lean_range_deg: max(lean) - min(lean),
    trunk_lean_peak_vel_dps: max(m("trunk_lean_vel_dps").map(Math.abs)),
    shoulder_depression_ratio: mean([gapChange("left"), gapChange("right")]),
    head_forward_change_m: max(m("head_forward_m")) - (series.metrics.head_forward_m?.[rep.startFrame] ?? Number.NaN),
    concentric_s: seconds(concentric),
    bottom_pause_s: seconds(bottom),
    eccentric_s: seconds(phase(rep, "eccentric")),
    wrist_height_asymmetry_m: max(m("wrist_height_diff_m").map(Math.abs)),
    // Averaged over the bottom pause rather than a frame-by-frame max, which mostly measures depth noise.
    elbow_flexion_asymmetry_deg: Math.abs(mean(m("elbow_flexion_diff_deg", frameAt(bottom.startMs), frameAt(bottom.endMs)))),
    peak_wrist_speed_mps: max([...m("left_wrist_speed_mps", cFrom, cTo), ...m("right_wrist_speed_mps", cFrom, cTo)]),
    peak_elbow_flexion_vel_dps: max([...m("left_elbow_flexion_vel_dps", cFrom, cTo), ...m("right_elbow_flexion_vel_dps", cFrom, cTo)]),
  };
}
