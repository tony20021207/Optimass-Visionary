import { parse as parseYaml } from "yaml";
import type { KinematicFinding, RootCauseHypothesis } from "@optimass/types";
import { rankRootCauses } from "../tier2/infer";
import type { Tier2Rules } from "../tier2/infer";
import { CoachingTable, SetFeedback } from "./schema";

export type CueKind = "comfort" | "form" | "feel";

export interface Cue {
  kind: CueKind;
  text: string;
  /** Why the lifter is getting this cue, in their words (an error, a muscle, a discomfort note). */
  because: string[];
}

export interface SetCoaching {
  errors: { findingId: string; errorCode: string; label: string; severity: KinematicFinding["severity"]; repIndices: number[] }[];
  causes: RootCauseHypothesis[];
  /** Comfort cues first, then form, then feel. Duplicate texts are merged. */
  cues: Cue[];
  /** Set when the lifter reported any discomfort. */
  safetyNote?: string;
}

export function parseCoachingTable(text: string, path = "coaching"): CoachingTable {
  const result = CoachingTable.safeParse(parseYaml(text));
  if (!result.success) throw new Error(`${path}: invalid coaching table\n${result.error.message}`);
  return result.data;
}

/**
 * Turns one set's Tier 1 findings and the lifter's feedback into errors, likely causes and cues.
 * Everything the lifter reads comes from the coaching and tier 2 tables; nothing clinical is decided here.
 */
export function coachSet(input: {
  findings: readonly KinematicFinding[];
  feedback: SetFeedback;
  coaching: CoachingTable;
  tier2?: Tier2Rules;
  /** How many top-ranked causes to show (default 3). */
  maxCauses?: number;
}): SetCoaching {
  const { findings, coaching } = input;
  const feedback = SetFeedback.parse(input.feedback);
  const errorLabels = input.tier2?.tables[coaching.exerciseId]?.errorCodes ?? {};
  const causes = input.tier2 ? rankRootCauses(findings, input.tier2).slice(0, input.maxCauses ?? 3) : [];

  const cues = new Map<string, Cue>();
  const add = (kind: CueKind, texts: readonly string[], because: string) => {
    for (const text of texts) {
      const cue = cues.get(text) ?? { kind, text, because: [] };
      if (!cue.because.includes(because)) cue.because.push(because);
      cues.set(text, cue);
    }
  };

  const areas = new Map(coaching.discomfort.areas.map((a) => [a.id, a]));
  for (const d of feedback.discomfort) {
    const area = d.areaId ? areas.get(d.areaId) : undefined;
    add("comfort", area?.cues ?? [], `Discomfort at ${formatTime(d.timeSec)}${area ? ` (${area.label.toLowerCase()})` : ""}`);
  }

  const errors = findings.map((f) => ({
    findingId: f.id,
    errorCode: f.errorCode,
    label: errorLabels[f.errorCode]?.label ?? f.label,
    severity: f.severity,
    repIndices: f.repIndices,
  }));
  for (const e of errors) add("form", coaching.formCues[e.errorCode] ?? [], e.label);
  // Hypothesis ids are `h_<exerciseId>_<causeId>` (see rankRootCauses).
  for (const c of causes) add("form", coaching.causeCues[c.id.replace(`h_${coaching.exerciseId}_`, "")] ?? [], `Likely cause: ${c.label}`);

  for (const m of coaching.feel.muscles) {
    const answer = feedback.muscles[m.id];
    if (!answer) continue;
    const rating = answer.felt ? (answer.rating ?? 0) : 0;
    if (m.role === "target" && (!answer.felt || rating <= coaching.feel.lowRating)) {
      add("feel", m.lowCues, answer.felt ? `You rated ${m.label.toLowerCase()} ${rating}/10` : `You didn't feel ${m.label.toLowerCase()}`);
    }
    if (m.role === "watch" && answer.felt && rating >= coaching.feel.highRating) {
      add("feel", m.highCues, `You rated ${m.label.toLowerCase()} ${rating}/10`);
    }
  }

  const order: Record<CueKind, number> = { comfort: 0, form: 1, feel: 2 };
  return {
    errors,
    causes,
    cues: [...cues.values()].sort((a, b) => order[a.kind] - order[b.kind]),
    safetyNote: feedback.discomfort.length > 0 ? coaching.discomfort.safetyNote : undefined,
  };
}

export const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
