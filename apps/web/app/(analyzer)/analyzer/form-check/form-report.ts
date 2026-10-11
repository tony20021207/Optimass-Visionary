// Turns Tier 1's pulldown report (packages/kinematics, analyzePulldown) into what the form check screen shows.
// Shapes are written out here so this file doesn't depend on kinematics internals beyond these fields.

export type CheckStatus = "pass" | "fail" | "info";

interface CheckResultLike {
  id: string;
  feature: string;
  value: number;
  min?: number;
  max?: number;
  status: CheckStatus;
  fault?: string;
}
interface PulldownReportLike {
  reps: { rep: { repIndex: number; startMs: number; endMs: number }; checks: CheckResultLike[] }[];
}
interface ParamsLike {
  version: string;
  reviewedBy: string | null;
  checks: { id: string; why?: string }[];
}

export interface CheckView {
  id: string;
  label: string;
  status: CheckStatus;
  value: number;
  min?: number;
  max?: number;
  unit: string;
  fault?: string;
  why?: string;
}

export interface RepView {
  repIndex: number;
  startSec: number;
  endSec: number;
  checks: CheckView[];
  fails: number;
}

export interface FormReportView {
  reps: RepView[];
  paramsVersion: string;
  reviewed: boolean;
}

/** Plain-language names for Tier 1's checks. Ids not listed fall back to the id with spaces. */
export const CHECK_LABELS: Record<string, string> = {
  full_stretch_at_top: "Full stretch at the top",
  arms_overhead_at_top: "Arms overhead at the top",
  bar_reaches_chest: "Bar reaches the chest",
  arms_down_at_bottom: "Arms all the way down",
  elbows_reach_trunk_line: "Elbows reach the trunk line",
  elbows_stop_near_trunk_line: "Elbows stop near the trunk line",
  pull_along_line: "Bar travels along the line of pull",
  forearms_on_line: "Forearms on the line of pull (side)",
  forearms_on_line_front: "Forearms on the line of pull (front)",
  trunk_lean_reasonable: "Trunk lean",
  trunk_stays_still: "Trunk stays still",
  no_torso_rocking: "No torso rocking",
  shoulders_depress: "Shoulders pull down, no shrug",
  head_stays_in_line: "Head stays in line",
  elbow_follows_shoulder: "Shoulder leads, elbow follows",
  shoulders_stay_back: "Shoulders don't roll forward",
  no_lockout_at_top: "No elbow lockout at the top",
  limited_internal_rotation_at_bottom: "Shoulder rotation at the bottom",
  controlled_eccentric: "Controlled return",
  no_yank: "No yanking",
  bar_stays_level: "Bar stays level",
  elbows_match: "Both elbows match",
  smooth_pull: "Smooth pull, no sticking point",
  tempo_consistent: "Steady tempo across the set",
  pace_pull_start: "Pull pacing: first quarter",
  pace_pull_middle: "Pull pacing: middle half",
  pace_pull_end: "Pull pacing: last quarter",
  pace_return_start: "Return pacing: leaving the bottom",
  pace_return_middle: "Return pacing: middle half",
  pace_return_end: "Return pacing: reaching the top",
  concentric_time: "Pull-down time",
  bottom_pause_time: "Pause at the bottom",
  top_pause_time: "Pause at the top",
  peak_wrist_speed: "Fastest wrist speed",
  peak_elbow_flexion_velocity: "Fastest elbow bend",
  forearm_break_at_bottom: "Forearm break at the bottom",
  grip_width: "Grip width",
  grip_matches_build: "Grip vs your build",
  shoulder_blades_retract: "Shoulder blades retract",
  elbow_yank: "Elbow acceleration",
  shoulder_yank: "Upper-arm acceleration",
  trunk_yank: "Trunk acceleration",
  elbow_bend_at_bottom: "Elbow bend at the bottom",
  shoulder_extension: "Shoulder extension",
  shoulder_adduction: "Shoulder adduction",
  extension_share: "Extension share of the pull",
  arm_plane_during_pull: "Arm plane during the pull",
  elbow_forward_at_bottom: "Elbow ahead of the shoulder at the bottom",
};

const label = (id: string) => CHECK_LABELS[id] ?? id.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Unit from the feature name's suffix, as Tier 1 names them. */
export function unitOf(feature: string): string {
  if (feature.endsWith("_dps2")) return "°/s²";
  if (feature.endsWith("_dps")) return "°/s";
  if (feature.endsWith("_deg")) return "°";
  if (feature.endsWith("_mps2")) return "m/s²";
  if (feature.endsWith("_mps")) return "m/s";
  if (feature.endsWith("_m")) return "m";
  if (feature.endsWith("_s")) return "s";
  if (feature.endsWith("_pct")) return "%";
  if (feature.endsWith("_x_arm")) return feature.startsWith("wrist_peak_acc") ? "arm lengths/s²" : "arm lengths";
  if (feature.endsWith("_x_trunk")) return "trunk lengths";
  if (feature.endsWith("_x_shoulder")) return "× shoulder width";
  return "";
}

/** A value rounded for reading: whole degrees, two decimals for small numbers. */
export function formatValue(value: number, unit: string, lang: "en" | "zh" = "en"): string {
  if (Number.isNaN(value)) return lang === "zh" ? "无法测量" : "not measurable";
  const abs = Math.abs(value);
  const digits = unit === "°" || unit === "°/s" || unit === "°/s²" || unit === "%" ? (abs < 10 ? 1 : 0) : abs < 1 ? 2 : 1;
  const n = value.toFixed(digits);
  const shown = lang === "zh" ? (UNITS_ZH[unit] ?? unit) : unit;
  return unit === "°" ? `${n}°` : shown ? `${n} ${shown}` : n;
}

const UNITS_ZH: Record<string, string> = { "arm lengths": "臂长", "arm lengths/s²": "臂长/s²", "trunk lengths": "躯干长", "× shoulder width": "× 肩宽" };

/** "max 15°", "10–18°", "min −5°". */
export function formatLimit(c: Pick<CheckView, "min" | "max" | "unit">, lang: "en" | "zh" = "en"): string {
  const f = (v: number) => formatValue(v, c.unit, lang);
  const zh = lang === "zh";
  if (c.min !== undefined && c.max !== undefined) return zh ? `${f(c.min)} 至 ${f(c.max)}` : `${f(c.min)} to ${f(c.max)}`;
  if (c.max !== undefined) return zh ? `不超过 ${f(c.max)}` : `at most ${f(c.max)}`;
  if (c.min !== undefined) return zh ? `至少 ${f(c.min)}` : `at least ${f(c.min)}`;
  return zh ? "仅测量" : "measured only";
}

const ORDER: Record<CheckStatus, number> = { fail: 0, pass: 1, info: 2 };

export function buildFormReport(report: PulldownReportLike, params: ParamsLike): FormReportView {
  const why = new Map(params.checks.map((c) => [c.id, c.why]));
  return {
    paramsVersion: params.version,
    reviewed: params.reviewedBy !== null,
    reps: report.reps.map(({ rep, checks }) => {
      const views = checks
        .map((c): CheckView => {
          const unit = unitOf(c.feature);
          return { id: c.id, label: label(c.id), status: c.status, value: c.value, min: c.min, max: c.max, unit, fault: c.fault, why: why.get(c.id) };
        })
        .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
      return { repIndex: rep.repIndex, startSec: rep.startMs / 1000, endSec: rep.endMs / 1000, checks: views, fails: views.filter((c) => c.status === "fail").length };
    }),
  };
}

/** Compact JSON for pasting into the Tier 1 thread when tuning limits. */
export function resultsForClaude(view: FormReportView, variation: string, video: { name: string; durationSec?: number }) {
  return JSON.stringify(
    {
      kind: "optimass-form-check",
      variation,
      paramsVersion: view.paramsVersion,
      video,
      reps: view.reps.map((r) => ({
        rep: r.repIndex + 1,
        startSec: +r.startSec.toFixed(2),
        endSec: +r.endSec.toFixed(2),
        failed: r.checks.filter((c) => c.status === "fail").map((c) => c.id),
        values: Object.fromEntries(r.checks.map((c) => [c.id, Number.isNaN(c.value) ? null : +c.value.toFixed(3)])),
      })),
    },
    null,
    1,
  );
}
