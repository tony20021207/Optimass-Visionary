import { parse as parseYaml } from "yaml";
import type { KinematicFinding, RootCauseHypothesis, Severity } from "@optimass/types";
import { Tier2Table } from "./schema";

/** Tier 2 tables keyed by exerciseId. */
export interface Tier2Rules {
  version: string;
  tables: Record<string, Tier2Table>;
}

const SEVERITY_ORDER: readonly Severity[] = ["minor", "moderate", "major"];

/** Parses and validates content/rules/tier2 YAML files. Throws with the file path on invalid content. */
export function parseTier2Rules(sources: readonly { path: string; text: string }[]): Tier2Rules {
  const tables: Record<string, Tier2Table> = {};
  for (const { path, text } of sources) {
    const result = Tier2Table.safeParse(parseYaml(text));
    if (!result.success) throw new Error(`${path}: invalid tier 2 rules\n${result.error.message}`);
    const table = result.data;
    if (tables[table.exerciseId]) throw new Error(`${path}: a second tier 2 table for ${table.exerciseId}`);
    tables[table.exerciseId] = table;
  }
  const version = Object.values(tables)
    .map((t) => `${t.exerciseId}@${t.version}`)
    .sort()
    .join(",");
  return { version, tables };
}

interface Candidate {
  hypothesis: Omit<RootCauseHypothesis, "rank">;
  order: number;
}

/**
 * Ranks root-cause hypotheses for Tier 1 findings. Scoring is a noisy-OR over matched patterns
 * (see the header of content/rules/tier2/*.yaml); every weight comes from the table.
 */
export function rankRootCauses(findings: readonly KinematicFinding[], rules: Tier2Rules): RootCauseHypothesis[] {
  const candidates: Candidate[] = [];
  const byExercise = new Map<string, KinematicFinding[]>();
  for (const f of findings) byExercise.set(f.exerciseId, [...(byExercise.get(f.exerciseId) ?? []), f]);

  for (const [exerciseId, exerciseFindings] of byExercise) {
    const table = rules.tables[exerciseId];
    if (!table) continue;
    const byCode = new Map<string, KinematicFinding[]>();
    for (const f of exerciseFindings) byCode.set(f.errorCode, [...(byCode.get(f.errorCode) ?? []), f]);

    table.causes.forEach((cause, order) => {
      let miss = 1 - cause.baseline;
      const explained = new Map<string, KinematicFinding>();
      let matched = false;
      for (const pattern of cause.patterns) {
        const matchedFindings = pattern.all.map((code) => byCode.get(code) ?? []);
        if (matchedFindings.some((fs) => fs.length === 0)) continue;
        matched = true;
        const flat = matchedFindings.flat();
        const worst = flat.reduce((w, f) => Math.max(w, SEVERITY_ORDER.indexOf(f.severity)), 0);
        const confidence = flat.reduce((s, f) => s + f.confidence, 0) / flat.length;
        miss *= 1 - pattern.weight * table.severityMultiplier[SEVERITY_ORDER[worst]!] * confidence;
        for (const f of flat) explained.set(f.id, f);
      }
      if (!matched) return;
      const test = table.screeningTests[cause.screeningTest]!;
      candidates.push({
        order,
        hypothesis: {
          id: `h_${exerciseId}_${cause.id}`,
          findingIds: [...explained.keys()],
          category: cause.category,
          label: cause.label,
          structures: { muscles: [...cause.structures.muscles], joints: [...cause.structures.joints] },
          likelihood: round(1 - miss),
          screeningTest: { id: cause.screeningTest, ...test },
        },
      });
    });
  }

  candidates.sort(
    (a, b) =>
      b.hypothesis.likelihood - a.hypothesis.likelihood ||
      b.hypothesis.findingIds.length - a.hypothesis.findingIds.length ||
      a.order - b.order ||
      a.hypothesis.id.localeCompare(b.hypothesis.id),
  );
  return candidates.map((c, i) => ({ ...c.hypothesis, rank: i + 1 }));
}

const round = (x: number) => Math.round(x * 1e4) / 1e4;
