// Tier 1 posture check: compares the 4-view posture screen to the editable parameter file.
import { POSTURE_FEATURES, type PostureFeature, type PostureFeatureResult } from "./metrics";
import defaultParamsJson from "./posture.params.json";

export interface PostureCheck {
  id: string;
  feature: PostureFeature;
  min?: number;
  max?: number;
  finding?: string;
  why?: string;
  placeholder?: boolean;
}

export interface PostureParams {
  version: string;
  reviewedBy: string | null;
  checks: PostureCheck[];
}

export interface PostureCheckResult {
  id: string;
  feature: PostureFeature;
  value: number;
  min?: number;
  max?: number;
  status: "pass" | "fail" | "info";
  finding?: string;
}

export function parsePostureParams(raw: unknown): PostureParams {
  const p = raw as Partial<PostureParams>;
  if (!p || !Array.isArray(p.checks)) throw new Error("posture params: expected { checks[] }");
  const seen = new Set<string>();
  for (const c of p.checks) {
    if (typeof c.id !== "string" || seen.has(c.id)) throw new Error(`posture params: missing or duplicate check id "${c.id}"`);
    seen.add(c.id);
    if (!(c.feature in POSTURE_FEATURES)) throw new Error(`posture params: check "${c.id}" has unknown feature "${c.feature}"`);
    for (const k of ["min", "max"] as const) {
      if (c[k] !== undefined && typeof c[k] !== "number") throw new Error(`posture params: check "${c.id}" ${k} must be a number`);
    }
    if (c.min !== undefined && c.max !== undefined && c.min > c.max) throw new Error(`posture params: check "${c.id}" has min > max`);
  }
  return { version: "unversioned", reviewedBy: null, ...p } as PostureParams;
}

export const DEFAULT_POSTURE_PARAMS: PostureParams = parsePostureParams(defaultParamsJson);

export function evaluatePosture(
  screen: Record<PostureFeature, PostureFeatureResult>,
  params: PostureParams = DEFAULT_POSTURE_PARAMS,
): PostureCheckResult[] {
  return params.checks.map((c) => {
    const value = screen[c.feature].value;
    const judged = c.min !== undefined || c.max !== undefined;
    const ok = (c.min === undefined || value >= c.min) && (c.max === undefined || value <= c.max);
    return {
      id: c.id,
      feature: c.feature,
      value,
      ...(c.min !== undefined && { min: c.min }),
      ...(c.max !== undefined && { max: c.max }),
      status: !judged ? "info" : ok ? "pass" : "fail",
      ...(c.finding !== undefined && { finding: c.finding }),
    };
  });
}
