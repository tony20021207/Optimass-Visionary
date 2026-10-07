import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse as parseYaml, stringify } from "yaml";
import { DiagnosticReport, RootCauseHypothesis } from "@optimass/types";
import type { KinematicFinding } from "@optimass/types";
import { inferRootCauses, parseTier2Rules } from "../index";
import type { RuleSet } from "../index";
import { pulldownFrontalFindings, pulldownSagittalFindings } from "./fixtures";

const tier2Dir = fileURLToPath(new URL("../../../../content/rules/tier2/", import.meta.url));
const sources = readdirSync(tier2Dir)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => ({ path: f, text: readFileSync(tier2Dir + f, "utf8") }));
const tier2 = parseTier2Rules(sources);
const rules: RuleSet = { version: { tier1: "fixture", tier2: tier2.version, tier3: "placeholder" }, tier2 };
const pulldownText = sources.find((s) => s.path === "lat_pulldown.yaml")!.text;

const only = (findings: KinematicFinding[], ...codes: string[]) => findings.filter((f) => codes.includes(f.errorCode));
const withYaml = (edit: (doc: Record<string, unknown>) => void) => {
  const doc = parseYaml(pulldownText) as Record<string, unknown>;
  edit(doc);
  return [{ path: "edited.yaml", text: stringify(doc) }];
};

describe("tier 2 content", () => {
  it("loads the lat pulldown table", () => {
    expect(tier2.tables.lat_pulldown).toBeDefined();
    expect(tier2.version).toContain("lat_pulldown@");
  });

  it("rejects a cause that points at a missing screening test", () => {
    const bad = withYaml((d) => ((d.causes as { screeningTest: string }[])[0]!.screeningTest = "nope"));
    expect(() => parseTier2Rules(bad)).toThrow(/unknown screening test nope/);
  });

  it("rejects a pattern that uses an undeclared error code", () => {
    const bad = withYaml((d) => ((d.causes as { patterns: { all: string[] }[] }[])[0]!.patterns[0]!.all = ["made_up"]));
    expect(() => parseTier2Rules(bad)).toThrow(/unknown error code made_up/);
  });
});

describe("inferRootCauses (lat pulldown)", () => {
  for (const [name, findings] of [
    ["sagittal", pulldownSagittalFindings],
    ["frontal", pulldownFrontalFindings],
  ] as const) {
    it(`${name}: every hypothesis parses, has a screening test and cites existing findings`, () => {
      const hs = inferRootCauses(findings, rules);
      expect(hs.length).toBeGreaterThan(0);
      const ids = new Set(findings.map((f) => f.id));
      for (const h of hs) {
        RootCauseHypothesis.parse(h);
        expect(h.screeningTest.procedure.length).toBeGreaterThan(0);
        for (const id of h.findingIds) expect(ids.has(id)).toBe(true);
      }
    });

    it(`${name}: ranks are 1..n with no gaps and likelihood never increases down the list`, () => {
      const hs = inferRootCauses(findings, rules);
      expect(hs.map((h) => h.rank)).toEqual(hs.map((_, i) => i + 1));
      hs.slice(1).forEach((h, i) => expect(h.likelihood).toBeLessThanOrEqual(hs[i]!.likelihood));
    });

    it(`${name}: fits into a valid DiagnosticReport`, () => {
      const view = findings[0]!.requiredView;
      DiagnosticReport.parse({
        id: "r",
        exerciseId: "lat_pulldown",
        cameraView: view,
        createdAt: "2026-10-07T00:00:00.000Z",
        reps: [],
        findings,
        hypotheses: inferRootCauses(findings, rules),
        prescriptions: [],
        rulesVersion: rules.version,
      });
    });
  }

  it("combined arching + short top range ranks the shoulder-flexion mobility cause first", () => {
    const [top] = inferRootCauses(only(pulldownSagittalFindings, "lumbar_hyperextension", "incomplete_top_rom"), rules);
    expect(top!.id).toBe("h_lat_pulldown_limited_shoulder_flexion_mobility");
    expect(top!.findingIds.sort()).toEqual(["f1", "f2"]);
  });

  it("combined torso lean + shrugging ranks load-too-heavy first", () => {
    const lean = only(pulldownSagittalFindings, "excessive_torso_lean");
    const shrug = only(pulldownFrontalFindings, "shoulder_elevation").map((f) => ({ ...f, id: "f9" }));
    const [top] = inferRootCauses([...lean, ...shrug], rules);
    expect(top!.id).toBe("h_lat_pulldown_load_exceeds_capacity");
  });

  it("a combined pattern beats the same cause scored from one error alone", () => {
    const alone = inferRootCauses(only(pulldownSagittalFindings, "lumbar_hyperextension"), rules);
    const both = inferRootCauses(only(pulldownSagittalFindings, "lumbar_hyperextension", "incomplete_top_rom"), rules);
    const pick = (hs: RootCauseHypothesis[]) => hs.find((h) => h.id === "h_lat_pulldown_limited_shoulder_flexion_mobility")!;
    expect(pick(both).likelihood).toBeGreaterThan(pick(alone).likelihood);
  });

  it("lower finding confidence lowers likelihood", () => {
    const shrug = only(pulldownFrontalFindings, "shoulder_elevation");
    const [hi] = inferRootCauses(shrug, rules);
    const [lo] = inferRootCauses(shrug.map((f) => ({ ...f, confidence: f.confidence / 2 })), rules);
    expect(lo!.id).toBe(hi!.id);
    expect(lo!.likelihood).toBeLessThan(hi!.likelihood);
  });

  it("returns nothing for no findings, unknown codes or exercises without a table", () => {
    expect(inferRootCauses([], rules)).toEqual([]);
    const f = pulldownSagittalFindings[0]!;
    expect(inferRootCauses([{ ...f, errorCode: "not_mapped" }], rules)).toEqual([]);
    expect(inferRootCauses([{ ...f, exerciseId: "barbell_back_squat" }], rules)).toEqual([]);
  });

  it("is driven by the data file: changing a weight changes the ranking", () => {
    const flipped = parseTier2Rules(
      withYaml((d) => {
        for (const c of d.causes as { id: string; patterns: { weight: number }[] }[]) {
          if (c.id === "limited_shoulder_flexion_mobility") c.patterns.forEach((p) => (p.weight = 0.01));
        }
      }),
    );
    const [top] = inferRootCauses(only(pulldownSagittalFindings, "lumbar_hyperextension", "incomplete_top_rom"), { ...rules, tier2: flipped });
    expect(top!.id).not.toBe("h_lat_pulldown_limited_shoulder_flexion_mobility");
  });

  it("throws a clear error when tier 2 rules are missing", () => {
    expect(() => inferRootCauses(pulldownSagittalFindings, { version: rules.version })).toThrow(/rules.tier2/);
  });
});
