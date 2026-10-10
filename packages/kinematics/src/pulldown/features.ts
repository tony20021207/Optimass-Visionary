// Per-rep summary numbers ("features") for a pulldown. Still no judgement: evaluate.ts compares them to the
// editable parameter file.
import type { RepSegment } from "@optimass/types";
import type { KinematicSeries } from "../index";
import { derivative, max, mean, min, smooth } from "../signal";

export const PULLDOWN_FEATURES = {
  elbow_flexion_top_deg: "Elbow flexion at the top (smallest in the rep, mean of both arms)",
  elbow_flexion_peak_deg: "Elbow flexion at the bottom (largest in the rep, mean of both arms)",
  humerothoracic_elevation_top_deg: "Upper arm vs trunk at the top (largest, mean of both arms)",
  humerothoracic_elevation_bottom_deg: "Upper arm vs trunk at the bottom (smallest, mean of both arms)",
  shoulder_extension_deg: "Shoulder extension performed from rep start to the bottom: arm rotation about the trunk's side-to-side axis (mean of both arms)",
  shoulder_adduction_deg: "Shoulder adduction performed from rep start to the bottom: arm rotation about the trunk's front-to-back axis (mean of both arms)",
  extension_share: "Share of the pull done by extension: extension / (extension + adduction). 0 = pure adduction, 1 = pure extension",
  plane_of_elevation_mid_deg: "Arm direction during the pull: 0 = out to the side (frontal plane), 90 = forward (sagittal plane); averaged over the pull where defined",
  humerus_behind_trunk_bottom_deg: "Upper arm angle behind the trunk line at the bottom (+ = elbows behind the body, arm rotating back around the shoulder; mean of both arms)",
  elbow_forward_bottom_m: "Elbow ahead of the shoulder at the bottom (m, + = in front of the body)",
  grip_width_x_shoulder: "Hand spacing on the bar as a multiple of shoulder width (wrist to wrist ÷ shoulder to shoulder, rep average)",
  grip_vs_recommended: "Grip width ÷ the grip recommended for this lifter's arm lengths (grip.ts; needs the posture-check skeleton, else NaN). 1 = on target",
  pull_line_deg: "Bar path angle from vertical, top of the rep to the bottom (+ = bar starts ahead and comes back toward the body)",
  forearm_off_line_deg: "Forearm vs the cable (line of force, pulley assumed above the knees), seen from the side, over the first three quarters of the pull (mean absolute angle, both arms)",
  forearm_off_line_bottom_deg: "Forearm vs the cable at the bottom (+ = elbows dropped behind the line; mean of both arms)",
  forearm_front_tilt_max_deg: "Front view: largest forearm tilt from vertical (the line of pull) over the bottom 80% of the pull down (mean of both arms per frame)",
  bar_bottom_rel_shoulder_m: "Lowest wrist-midpoint height relative to the shoulders",
  bar_bottom_rel_shoulder_x_arm: "Lowest wrist-midpoint height relative to the shoulders, in arm lengths (shoulder → elbow → wrist), so it scales with the lifter",
  trunk_lean_mean_deg: "Average trunk lean back from vertical",
  trunk_lean_range_deg: "How much the trunk lean changes within the rep",
  trunk_lean_peak_vel_dps: "Fastest trunk rocking during the pull down (absolute angular velocity)",
  shoulder_depression_ratio: "Ear-to-shoulder gap gained from top to bottom, in shoulder widths (positive = depressed)",
  shoulder_narrowing_ratio: "Shoulder blade retraction proxy: how much the shoulder-to-shoulder distance shrinks from the top to the bottom, as a fraction of the top width",
  head_forward_change_m: "How far the ears move forward of the trunk line during the rep (m)",
  head_forward_change_x_trunk: "How far the ears move forward of the trunk line during the rep, in trunk lengths (hip midpoint to shoulder midpoint)",
  concentric_s: "Time to pull the bar down (5%–95% of travel)",
  bottom_pause_s: "Time held at the bottom",
  eccentric_s: "Time to return the bar to the top (95%–5% of travel)",
  top_pause_s: "Time held at the top (arms overhead) before the next pull. The last rep's pause is cut short by the clip end.",
  wrist_height_asymmetry_m: "Largest left-right wrist height difference (bar tilt)",
  bar_tilt_max_deg: "Largest bar tilt: the wrist-to-wrist line's angle from horizontal, independent of grip width and body size",
  elbow_flexion_asymmetry_deg: "Left-right elbow flexion difference, averaged over the bottom of the rep",
  peak_wrist_speed_mps: "Fastest wrist speed during the pull",
  peak_elbow_flexion_vel_dps: "Fastest elbow flexion during the pull",
  wrist_peak_acc_mps2: "Yank check: largest wrist acceleration (vector, change of speed or direction) from just before the pull starts to the bottom",
  elbow_peak_acc_dps2: "Yank check: largest elbow flexion angular acceleration over the same window (both arms)",
  shoulder_peak_acc_dps2: "Yank check: largest upper-arm (humerothoracic elevation) angular acceleration over the same window (both arms)",
  trunk_peak_acc_dps2: "Yank check: largest trunk lean angular acceleration over the same window",
  concentric_part1_share: "Pacing: share of the pull-down time spent in its first part (top to 25% of the bar's travel). Pull and return are timed between the 5% bands at the top and bottom, so the slow ends read slightly short",
  concentric_part2_share: "Pacing: share of the pull-down time spent in its middle part (25% to 75% of bar travel)",
  concentric_part3_share: "Pacing: share of the pull-down time spent in its last part (75% of bar travel to the bottom)",
  eccentric_part1_share: "Pacing: share of the return time spent leaving the bottom (bottom to 75% of the way down)",
  eccentric_part2_share: "Pacing: share of the return time spent in its middle part (75% to 25% of the way down)",
  eccentric_part3_share: "Pacing: share of the return time spent reaching the top (25% of the way down to the top)",
  speed_dip_pct: "Smoothness: deepest mid-movement slowdown of the bar, pull or return, as a percentage of the speed before and after it (0 = speed rises and falls once, no sticking point)",
  tempo_variation_pct: "Tempo consistency across the set: rep-to-rep variation (coefficient of variation, %) of the pull-down or return time, whichever varies more. Same value on every rep; needs 2+ reps",
} as const;
export type PulldownFeature = keyof typeof PULLDOWN_FEATURES;
export type PulldownFeatures = Record<PulldownFeature, number>;

const phase = (rep: RepSegment, name: string) => rep.phases.find((p) => p.phase === name)!;
const seconds = (p: { startMs: number; endMs: number }) => (p.endMs - p.startMs) / 1000;

/**
 * Time shares of a movement's three parts: frames from `from` to `to`, split where the bar has covered 25% and 75% of
 * the way from `fromH` to `toH`.
 */
function partShares(height: number[], t: number[], from: number, to: number): [number, number, number] {
  const total = t[to]! - t[from]!;
  const fromH = height[from]!;
  const toH = height[to]!;
  const reach = (share: number) => {
    for (let i = from; i <= to; i++) if ((height[i]! - fromH) / (toH - fromH) >= share) return t[i]!;
    return t[to]!;
  };
  const a = reach(0.25);
  const b = reach(0.75);
  if (!(total > 0)) return [Number.NaN, Number.NaN, Number.NaN];
  return [(a - t[from]!) / total, (b - a) / total, (t[to]! - b) / total];
}

/** Smoothing window (frames) for the bar-speed curve; signal processing, not a clinical value. */
const SPEED_SMOOTHING = 9;

/**
 * Deepest slowdown in the middle of a movement: the bar's speed should rise to one peak and fall (a sticking point or
 * a hitch shows as a dip between two peaks). Returns the dip as % of the lower of the two peaks around it (0 = none).
 * Only the middle 80% of the movement counts, so the start and stop don't read as dips.
 */
function speedDipPct(height: number[], t: number[], from: number, to: number): number {
  if (to - from < 6) return 0;
  const raw = height.slice(from, to + 1);
  const ts = t.slice(from, to + 1);
  const speed = smooth(derivative(raw, ts).map(Math.abs), SPEED_SMOOTHING);
  const lo = Math.floor(speed.length * 0.1);
  const hi = Math.ceil(speed.length * 0.9);
  let worst = 0;
  for (let i = lo + 1; i < hi - 1; i++) {
    if (!(speed[i]! <= speed[i - 1]! && speed[i]! <= speed[i + 1]!)) continue;
    const before = max(speed.slice(0, i));
    const after = max(speed.slice(i + 1));
    const ref = Math.min(before, after);
    if (ref > 0) worst = Math.max(worst, ((ref - speed[i]!) / ref) * 100);
  }
  return worst;
}

const median = (xs: number[]): number => {
  const s = xs.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : Number.NaN;
};

/** Coefficient of variation (%) of a list of durations. */
function cvPct(xs: number[]): number {
  if (xs.length < 2) return Number.NaN;
  const m = mean(xs);
  return (Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) / m) * 100;
}

/** Set-level numbers copied onto every rep (tempo consistency needs the whole set). */
export function addSetFeatures(reps: { features: PulldownFeatures }[]): void {
  const v = Math.max(cvPct(reps.map((r) => r.features.concentric_s)), cvPct(reps.map((r) => r.features.eccentric_s)));
  for (const r of reps) r.features.tempo_variation_pct = v;
}

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
  const up = series.metrics.wrist_mid_up_m!;
  const fwd = series.metrics.wrist_mid_fwd_m!;
  const pullLine = Math.atan2(fwd[rep.startFrame]! - fwd[bottomFrame]!, up[rep.startFrame]! - up[bottomFrame]!) * (180 / Math.PI);
  const offLine = (side: "left" | "right", i: number) =>
    series.metrics[`${side}_forearm_pitch_deg`]![i]! - series.metrics.cable_pitch_deg![i]!;
  const onLineTo = rep.startFrame + Math.round((bottomFrame - rep.startFrame) * 0.75);
  const onLineFrames = Array.from({ length: Math.max(1, onLineTo - rep.startFrame + 1) }, (_, k) => rep.startFrame + k);
  // Bottom 80% of the pull down: from 20% of the bar's travel to the bottom.
  const topH = height[0]!;
  const bottomH = min(height);
  const front = (i: number) =>
    mean([Math.abs(series.metrics.left_forearm_front_tilt_deg![i]!), Math.abs(series.metrics.right_forearm_front_tilt_deg![i]!)]);
  const lowerFrames = Array.from({ length: bottomFrame - rep.startFrame + 1 }, (_, k) => rep.startFrame + k).filter(
    (i) => (topH - series.metrics.wrist_mid_height_m![i]!) >= 0.2 * (topH - bottomH),
  );
  // Yank window: from a few frames before the pull starts (the snap off the top) to the bottom.
  const yankFrom = Math.max(0, rep.startFrame - 5);
  const peakAbs = (...names: string[]) => max(names.flatMap((nm) => m(nm, yankFrom, bottomFrame).map(Math.abs)));
  const performed = (name: string) =>
    mean((["left", "right"] as const).map((side) => {
      const cum = series.metrics[`${side}_${name}`]!;
      return cum[bottomFrame]! - cum[rep.startFrame]!;
    }));
  // Pacing and smoothness on the bar (wrist midpoint) height in the room, above the hips: the shoulders move, the bar's
  // path is what the lifter paces.
  const bar = series.metrics.wrist_mid_up_m!;
  const eccentric = phase(rep, "eccentric");
  const eFrom = frameAt(eccentric.startMs);
  const eTo = frameAt(eccentric.endMs);
  const con = partShares(bar, t, cFrom, cTo);
  const ecc = partShares(bar, t, eFrom, eTo);
  const ext = performed("shoulder_extension_cum_deg");
  const add = performed("shoulder_adduction_cum_deg");

  return {
    elbow_flexion_top_deg: both(min, "elbow_flexion_deg"),
    elbow_flexion_peak_deg: both(max, "elbow_flexion_deg"),
    humerothoracic_elevation_top_deg: both(max, "humerothoracic_elevation_deg"),
    humerothoracic_elevation_bottom_deg: both(min, "humerothoracic_elevation_deg"),
    shoulder_extension_deg: ext,
    shoulder_adduction_deg: add,
    extension_share: Math.abs(ext) + Math.abs(add) === 0 ? Number.NaN : Math.abs(ext) / (Math.abs(ext) + Math.abs(add)),
    plane_of_elevation_mid_deg: mean(
      [...m("left_plane_of_elevation_deg", cFrom, cTo), ...m("right_plane_of_elevation_deg", cFrom, cTo)].filter((x) => !Number.isNaN(x)),
    ),
    humerus_behind_trunk_bottom_deg: mean([
      series.metrics.left_humerus_behind_trunk_deg![bottomFrame]!,
      series.metrics.right_humerus_behind_trunk_deg![bottomFrame]!,
    ]),
    elbow_forward_bottom_m: mean([series.metrics.left_elbow_forward_m![bottomFrame]!, series.metrics.right_elbow_forward_m![bottomFrame]!]),
    grip_width_x_shoulder: mean(m("grip_width_x_shoulder")),
    grip_vs_recommended: Number.NaN, // filled in by analyzePulldown when a skeleton is given
    pull_line_deg: pullLine,
    forearm_off_line_deg: mean(onLineFrames.flatMap((i) => [Math.abs(offLine("left", i)), Math.abs(offLine("right", i))])),
    forearm_off_line_bottom_deg: mean([offLine("left", bottomFrame), offLine("right", bottomFrame)]),
    forearm_front_tilt_max_deg: max(lowerFrames.map(front)),
    bar_bottom_rel_shoulder_m: min(height),
    bar_bottom_rel_shoulder_x_arm: min(height) / median(m("arm_length_m")),
    trunk_lean_mean_deg: mean(lean),
    trunk_lean_range_deg: max(lean) - min(lean),
    trunk_lean_peak_vel_dps: max(m("trunk_lean_vel_dps", cFrom, cTo).map(Math.abs)),
    shoulder_depression_ratio: mean([gapChange("left"), gapChange("right")]),
    shoulder_narrowing_ratio: (series.metrics.shoulder_width_m![rep.startFrame]! - series.metrics.shoulder_width_m![bottomFrame]!) / series.metrics.shoulder_width_m![rep.startFrame]!,
    head_forward_change_m: max(m("head_forward_m")) - (series.metrics.head_forward_m?.[rep.startFrame] ?? Number.NaN),
    head_forward_change_x_trunk: (max(m("head_forward_m")) - (series.metrics.head_forward_m?.[rep.startFrame] ?? Number.NaN)) / median(m("trunk_length_m")),
    concentric_s: seconds(concentric),
    bottom_pause_s: seconds(bottom),
    eccentric_s: seconds(phase(rep, "eccentric")),
    top_pause_s: seconds(phase(rep, "lockout")),
    wrist_height_asymmetry_m: max(m("wrist_height_diff_m").map(Math.abs)),
    bar_tilt_max_deg: max(m("bar_tilt_deg").map(Math.abs)),
    // Averaged over the bottom pause rather than a frame-by-frame max, which mostly measures depth noise.
    elbow_flexion_asymmetry_deg: Math.abs(mean(m("elbow_flexion_diff_deg", frameAt(bottom.startMs), frameAt(bottom.endMs)))),
    peak_wrist_speed_mps: max([...m("left_wrist_speed_mps", cFrom, cTo), ...m("right_wrist_speed_mps", cFrom, cTo)]),
    peak_elbow_flexion_vel_dps: max([...m("left_elbow_flexion_vel_dps", cFrom, cTo), ...m("right_elbow_flexion_vel_dps", cFrom, cTo)]),
    wrist_peak_acc_mps2: peakAbs("left_wrist_acc_mps2", "right_wrist_acc_mps2"),
    elbow_peak_acc_dps2: peakAbs("left_elbow_flexion_acc_dps2", "right_elbow_flexion_acc_dps2"),
    shoulder_peak_acc_dps2: peakAbs("left_humerothoracic_elevation_acc_dps2", "right_humerothoracic_elevation_acc_dps2"),
    trunk_peak_acc_dps2: peakAbs("trunk_lean_acc_dps2"),
    concentric_part1_share: con[0],
    concentric_part2_share: con[1],
    concentric_part3_share: con[2],
    eccentric_part1_share: ecc[0],
    eccentric_part2_share: ecc[1],
    eccentric_part3_share: ecc[2],
    speed_dip_pct: Math.max(speedDipPct(bar, t, cFrom, cTo), speedDipPct(bar, t, eFrom, eTo)),
    tempo_variation_pct: Number.NaN, // filled in for the whole set by addSetFeatures
  };
}
