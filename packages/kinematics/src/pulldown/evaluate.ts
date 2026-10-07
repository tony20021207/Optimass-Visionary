// Compares per-rep features to the editable parameter file. A prototype of what M6a will do with content/rules.
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

export interface PulldownParams {
  exerciseId: string;
  version: string;
  reviewedBy: string | null;
  checks: PulldownCheck[];
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
  return { version: "unversioned", reviewedBy: null, ...p } as PulldownParams;
}

export const DEFAULT_PULLDOWN_PARAMS: PulldownParams = parsePulldownParams(defaultParamsJson);

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
