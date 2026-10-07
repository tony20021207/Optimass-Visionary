import { evaluatePosture, type PostureCheckResult, type PostureParams } from "./evaluate";
import { postureScreen, type PostureFeature, type PostureFeatureResult } from "./metrics";
import type { PostureCapture } from "./synth";

export * from "./evaluate";
export * from "./metrics";
export * from "./synth";

export interface PostureReport {
  features: Record<PostureFeature, PostureFeatureResult>;
  checks: PostureCheckResult[];
}

/** Four still captures (front, back, left, right) → posture features → checks against the parameter file. */
export function analyzePosture(captures: PostureCapture[], params?: PostureParams): PostureReport {
  const features = postureScreen(captures);
  return { features, checks: evaluatePosture(features, params) };
}
