import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { coachSet, parseCoachingTable, parseTier2Rules, pulldownFrontalFindings, pulldownSagittalFindings } from "../index";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../../../../content/rules/${rel}`, import.meta.url)), "utf8");
const coaching = parseCoachingTable(read("coaching/lat_pulldown.yaml"));
const tier2 = parseTier2Rules([{ path: "lat_pulldown.yaml", text: read("tier2/lat_pulldown.yaml") }]);

describe("coachSet (lat pulldown)", () => {
  it("lists the set's errors with tier 2 labels and form cues for each", () => {
    const out = coachSet({ findings: pulldownSagittalFindings, feedback: {}, coaching, tier2 });
    expect(out.errors.map((e) => e.errorCode)).toEqual(["lumbar_hyperextension", "incomplete_top_rom", "excessive_torso_lean"]);
    expect(out.errors[1]!.label).toBe("Arms don't reach full overhead extension at the top of the rep");
    expect(out.cues.some((c) => c.kind === "form" && c.because.includes(out.errors[1]!.label))).toBe(true);
    expect(out.causes.length).toBeGreaterThan(0);
    expect(out.causes.length).toBeLessThanOrEqual(3);
    expect(out.safetyNote).toBeUndefined();
  });

  it("adds cause cues for top-ranked causes that have them", () => {
    const out = coachSet({ findings: pulldownFrontalFindings, feedback: {}, coaching, tier2, maxCauses: 5 });
    expect(out.causes.map((c) => c.id)).toContain("h_lat_pulldown_load_exceeds_capacity");
    expect(out.cues.map((c) => c.text)).toContain(coaching.causeCues.load_exceeds_capacity![0]);
  });

  it("gives feel cues for a barely-felt target muscle and an over-working watch muscle only", () => {
    const out = coachSet({
      findings: [],
      feedback: {
        muscles: {
          lats_teres_major: { felt: true, rating: 3 },
          rhomboids: { felt: true, rating: 8 },
          upper_traps_neck: { felt: true, rating: 9 },
          posterior_deltoid: { felt: true, rating: 5 },
        },
      },
      coaching,
    });
    const feel = out.cues.filter((c) => c.kind === "feel");
    const lats = coaching.feel.muscles.find((m) => m.id === "lats_teres_major")!;
    const traps = coaching.feel.muscles.find((m) => m.id === "upper_traps_neck")!;
    expect(feel.map((c) => c.text).sort()).toEqual([...lats.lowCues, ...traps.highCues].sort());
    expect(feel[0]!.because[0]).toMatch(/\d\/10/);
  });

  it("treats a target muscle that wasn't felt at all as barely felt", () => {
    const out = coachSet({ findings: [], feedback: { muscles: { lats_teres_major: { felt: false } } }, coaching });
    expect(out.cues.map((c) => c.because[0])).toContain("You didn't feel lats and teres major");
  });

  it("puts discomfort cues first, with the moment and the safety note", () => {
    const out = coachSet({
      findings: pulldownSagittalFindings,
      feedback: { discomfort: [{ id: "d1", timeSec: 12.4, point: { x: 0.4, y: 0.3 }, areaId: "front_of_shoulder", note: "pinch at the bottom" }] },
      coaching,
      tier2,
    });
    expect(out.cues[0]!.kind).toBe("comfort");
    expect(out.cues[0]!.because[0]).toBe("Discomfort at 0:12 (front of the shoulder)");
    expect(out.safetyNote).toBe(coaching.discomfort.safetyNote);
  });

  it("merges the same cue from two reasons", () => {
    const out = coachSet({
      findings: [],
      feedback: {
        discomfort: [
          { id: "a", timeSec: 3, areaId: "top_of_shoulder" },
          { id: "b", timeSec: 9, areaId: "top_of_shoulder" },
        ],
      },
      coaching,
    });
    expect(out.cues).toHaveLength(1);
    expect(out.cues[0]!.because).toHaveLength(2);
  });

  it("rejects an invalid coaching file", () => {
    expect(() => parseCoachingTable("version: x\nexerciseId: lat_pulldown\n")).toThrow(/invalid coaching table/);
  });
});
