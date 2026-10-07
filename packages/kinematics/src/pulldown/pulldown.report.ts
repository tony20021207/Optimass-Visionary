// Run with `pnpm --filter @optimass/kinematics pulldown:report`.
// Prints every synthetic variant's per-rep features next to the parameter file's limits, so you can see what a
// change to good-pulldown.params.json or to a profile in synth.ts does.
import { it } from "vitest";
import { DEFAULT_PULLDOWN_PARAMS, PULLDOWN_VARIANTS, analyzePulldown, synthesizePulldown, type PulldownVariant } from "./index";

it("pulldown report", () => {
  const variants = Object.keys(PULLDOWN_VARIANTS) as PulldownVariant[];
  const reports = Object.fromEntries(variants.map((v) => [v, analyzePulldown(synthesizePulldown(PULLDOWN_VARIANTS[v]))]));
  const rows: Record<string, Record<string, string>> = {};
  for (const check of DEFAULT_PULLDOWN_PARAMS.checks) {
    const limit = [check.min !== undefined ? `≥${check.min}` : "", check.max !== undefined ? `≤${check.max}` : ""].join(" ").trim();
    const row: Record<string, string> = { feature: check.feature, limit: limit || "(info)" };
    for (const v of variants) {
      // Middle rep, to stay clear of clip edges.
      const reps = reports[v]!.reps;
      const r = reps[Math.floor(reps.length / 2)]!.checks.find((c) => c.id === check.id)!;
      row[v] = `${r.value.toFixed(r.value < 10 ? 3 : 1)}${r.status === "fail" ? " ✗" : ""}`;
    }
    rows[check.id] = row;
  }
  console.log(`Params ${DEFAULT_PULLDOWN_PARAMS.version} (placeholders, reviewed by: ${DEFAULT_PULLDOWN_PARAMS.reviewedBy ?? "nobody yet"})`);
  console.log(`Reps found: ${variants.map((v) => `${v}=${reports[v]!.reps.length}`).join(", ")}`);
  console.table(rows);
});
