// Tier 1 form detection: compares per-rep features to the editable parameter file. A prototype of what M6a will do with content/rules/tier1.
import { PULLDOWN_FEATURES, type PulldownFeature, type PulldownFeatures } from "./features";
import defaultParamsJson from "./good-pulldown.params.json";

export interface PulldownCheck {
  id: string;
  feature: PulldownFeature;
  min?: number;
  max?: number;
  fault?: string;
  why?: string;
  placeholder?: boolean;
}

/** One variation's change to a check's limits: a number replaces the limit, null removes it, absent keeps it. */
export interface PulldownLimitOverride {
  min?: number | null;
  max?: number | null;
  why?: string;
}

export interface PulldownParams {
  exerciseId: string;
  version: string;
  reviewedBy: string | null;
  checks: PulldownCheck[];
  /**
   * Per-variation limits (Tony, 2026-10-10): close grips move differently by design, so a variation (PULLDOWN_SETUPS id)
   * can change a check's limits. Checks it doesn't name keep the shared limits. Read through pulldownParamsFor.
   */
  variations?: Record<string, Record<string, PulldownLimitOverride>>;
}

export type CheckStatus = "pass" | "fail" | "info";

export interface CheckResult {
  id: string;
  feature: PulldownFeature;
  value: number;
  min?: number;
  max?: number;
  status: CheckStatus;
  fault?: string;
}

/** Validates a parameter object (e.g. the JSON file after Tony edits it) and returns it typed. */
export function parsePulldownParams(raw: unknown): PulldownParams {
  const p = raw as Partial<PulldownParams>;
  if (!p || typeof p.exerciseId !== "string" || !Array.isArray(p.checks)) {
    throw new Error("pulldown params: expected { exerciseId, checks[] }");
  }
  const seen = new Set<string>();
  for (const c of p.checks) {
    if (typeof c.id !== "string" || seen.has(c.id)) throw new Error(`pulldown params: missing or duplicate check id "${c.id}"`);
    seen.add(c.id);
    if (!(c.feature in PULLDOWN_FEATURES)) throw new Error(`pulldown params: check "${c.id}" has unknown feature "${c.feature}"`);
    for (const k of ["min", "max"] as const) {
      if (c[k] !== undefined && typeof c[k] !== "number") throw new Error(`pulldown params: check "${c.id}" ${k} must be a number`);
    }
    if (c.min !== undefined && c.max !== undefined && c.min > c.max) throw new Error(`pulldown params: check "${c.id}" has min > max`);
  }
  for (const [variation, overrides] of Object.entries(p.variations ?? {})) {
    for (const [id, o] of Object.entries(overrides)) {
      if (!seen.has(id)) throw new Error(`pulldown params: variation "${variation}" overrides unknown check "${id}"`);
      for (const k of ["min", "max"] as const) {
        if (o[k] !== undefined && o[k] !== null && typeof o[k] !== "number") throw new Error(`pulldown params: variation "${variation}" check "${id}" ${k} must be a number or null`);
      }
    }
  }
  return { version: "unversioned", reviewedBy: null, ...p } as PulldownParams;
}

export const DEFAULT_PULLDOWN_PARAMS: PulldownParams = parsePulldownParams(defaultParamsJson);

/**
 * The checks as they apply to one variation: the shared limits with that variation's overrides on top. The result has
 * no `variations` of its own, so evaluatePulldownRep and Motion Lab can use it directly.
 */
export function pulldownParamsFor(params: PulldownParams, variation: string): PulldownParams {
  const overrides = params.variations?.[variation] ?? {};
  const checks = params.checks.map((c) => {
    const o = overrides[c.id];
    if (!o) return { ...c };
    const out: PulldownCheck = { ...c };
    for (const k of ["min", "max"] as const) {
      if (o[k] === null) delete out[k];
      else if (o[k] !== undefined) out[k] = o[k];
    }
    if (o.why) out.why = `${c.why ?? ""} ${variation}: ${o.why}`.trim();
    return out;
  });
  const { variations: _, ...rest } = params;
  return { ...rest, checks };
}

export function evaluatePulldownRep(features: PulldownFeatures, params: PulldownParams = DEFAULT_PULLDOWN_PARAMS): CheckResult[] {
  return params.checks.map((c) => {
    const value = features[c.feature];
    const judged = c.min !== undefined || c.max !== undefined;
    const ok = (c.min === undefined || value >= c.min) && (c.max === undefined || value <= c.max);
    return {
      id: c.id,
      feature: c.feature,
      value,
      ...(c.min !== undefined && { min: c.min }),
      ...(c.max !== undefined && { max: c.max }),
      status: !judged ? "info" : ok ? "pass" : "fail",
      ...(c.fault !== undefined && { fault: c.fault }),
    };
  });
}
