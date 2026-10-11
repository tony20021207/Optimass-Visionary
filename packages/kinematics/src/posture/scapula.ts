// Scapula step of the posture check (Tony, 2026-10-10). MediaPipe has no scapula landmarks, so the scapula is read
// from points tapped on the back-view photo, plus an observer's grade of the dynamic arm-raise test (winging and tilt
// often show only under movement). The findings predict which movement errors to expect, so Tier 1 can watch those
// checks and Tier 2 can start with those causes. Every threshold and prediction is Tony's to author in
// scapula-predictions.json; this file only measures and applies that table.
import predictionsJson from "./scapula-predictions.json";

/** A point tapped on the back-view photo, in image pixels (x right, y down). */
export interface ImagePoint {
  x: number;
  y: number;
}

/** Bony landmarks tapped on one scapula in the back view. */
export interface ScapulaMarks {
  /** Root of the spine of the scapula (where the spine meets the medial border). */
  spineRoot: ImagePoint;
  /** Inferior angle. */
  inferiorAngle: ImagePoint;
}

/** Observer's grade of the dynamic arm-raise test for one side (scapular dyskinesis test style). */
export type DyskinesisGrade = "normal" | "subtle" | "obvious";

export interface ScapulaObservation {
  /** Medial border or inferior angle lifting off the ribs. */
  winging: DyskinesisGrade;
  /** Inferior angle prominent (scapula tipped forward at the top). */
  anteriorTilt: DyskinesisGrade;
}

export interface ScapulaScreen {
  /** The user agreed to the scapula step's warning (SCAPULA_CONSENT). Without it nothing here is captured or kept. */
  consent: boolean;
  left: ScapulaMarks;
  right: ScapulaMarks;
  /** Meters per pixel at the user's back (from the posture camera's known distance); ratios only when absent. */
  metersPerPixel?: number;
  observed?: { left: ScapulaObservation; right: ScapulaObservation };
}

export const SCAPULA_FEATURES = [
  "left_scapula_upward_rotation_deg",
  "right_scapula_upward_rotation_deg",
  "left_scapula_to_spine",
  "right_scapula_to_spine",
  "inferior_angle_height_diff",
  "left_winging_grade",
  "right_winging_grade",
  "left_anterior_tilt_grade",
  "right_anterior_tilt_grade",
] as const;
export type ScapulaFeature = (typeof SCAPULA_FEATURES)[number];

const GRADE: Record<DyskinesisGrade, number> = { normal: 0, subtle: 1, obvious: 2 };

/**
 * Scapula position at rest from the tapped points. Distances are meters when `metersPerPixel` is given, otherwise a
 * share of the distance between the two spine roots.
 * - `*_scapula_upward_rotation_deg`: medial border (spine root → inferior angle) from vertical; + = inferior angle
 *   further from the spine than the spine root (upward rotation), − = downward rotation.
 * - `*_scapula_to_spine`: inferior angle's distance from the midline (scapular abduction / protraction).
 * - `inferior_angle_height_diff`: left minus right inferior angle height; + = left sits higher.
 * - `*_grade`: 0 normal, 1 subtle, 2 obvious (from the dynamic test; absent when it wasn't observed).
 */
export function scapulaFeatures(screen: ScapulaScreen): Partial<Record<ScapulaFeature, number>> {
  if (!screen.consent) throw new Error("scapula step needs the user's consent (SCAPULA_CONSENT)");
  const { left, right } = screen;
  const midX = (left.spineRoot.x + right.spineRoot.x) / 2;
  const span = Math.hypot(left.spineRoot.x - right.spineRoot.x, left.spineRoot.y - right.spineRoot.y);
  const scale = screen.metersPerPixel ?? 1 / span;
  // Back view: the user's left is on the image's left.
  const outward = (side: "left" | "right", x: number) => (side === "left" ? midX - x : x - midX);
  const rotation = (side: "left" | "right", m: ScapulaMarks) =>
    (Math.atan2(outward(side, m.inferiorAngle.x) - outward(side, m.spineRoot.x), m.inferiorAngle.y - m.spineRoot.y) * 180) / Math.PI;
  const out: Partial<Record<ScapulaFeature, number>> = {
    left_scapula_upward_rotation_deg: rotation("left", left),
    right_scapula_upward_rotation_deg: rotation("right", right),
    left_scapula_to_spine: outward("left", left.inferiorAngle.x) * scale,
    right_scapula_to_spine: outward("right", right.inferiorAngle.x) * scale,
    inferior_angle_height_diff: (right.inferiorAngle.y - left.inferiorAngle.y) * scale,
  };
  if (screen.observed) {
    out.left_winging_grade = GRADE[screen.observed.left.winging];
    out.right_winging_grade = GRADE[screen.observed.right.winging];
    out.left_anterior_tilt_grade = GRADE[screen.observed.left.anteriorTilt];
    out.right_anterior_tilt_grade = GRADE[screen.observed.right.anteriorTilt];
  }
  return out;
}

/** One rule in Tony's table: a scapula finding at rest and the movement errors it predicts. */
export interface ScapulaPrediction {
  id: string;
  feature: ScapulaFeature;
  min?: number;
  max?: number;
  /** What the finding is, in clinical words. */
  finding: string;
  /** Tier 1 error codes to expect (e.g. shoulder_elevation, asymmetric_pull). */
  predicts: string[];
  /** Exercises it applies to; all when absent. */
  exercises?: string[];
  why?: string;
  placeholder?: boolean;
}

export interface ScapulaPredictionTable {
  version: string;
  reviewedBy: string | null;
  predictions: ScapulaPrediction[];
}

export function parseScapulaPredictions(raw: unknown): ScapulaPredictionTable {
  const t = raw as ScapulaPredictionTable;
  if (!t || !Array.isArray(t.predictions)) throw new Error("scapula predictions: missing predictions list");
  for (const p of t.predictions) {
    if (!(SCAPULA_FEATURES as readonly string[]).includes(p.feature)) throw new Error(`scapula prediction ${p.id}: unknown feature ${p.feature}`);
    if (p.min === undefined && p.max === undefined) throw new Error(`scapula prediction ${p.id}: needs min or max`);
    if (p.min !== undefined && p.max !== undefined && p.min > p.max) throw new Error(`scapula prediction ${p.id}: min > max`);
    if (!Array.isArray(p.predicts) || !p.predicts.length) throw new Error(`scapula prediction ${p.id}: predicts nothing`);
  }
  return t;
}

/** Tony's table (empty until he writes it). */
export const DEFAULT_SCAPULA_PREDICTIONS = parseScapulaPredictions(predictionsJson);

/** The warning shown before the scapula step, and what is kept. */
export const SCAPULA_CONSENT = predictionsJson.consent;

export interface PredictedError {
  errorCode: string;
  /** Rule ids that predicted it. */
  because: string[];
}

/**
 * Movement errors to expect from the scapula findings: a rule fires when its feature is below `min` or above `max`.
 * Features that weren't measured never fire.
 */
export function predictFromScapula(
  features: Partial<Record<ScapulaFeature, number>>,
  exerciseId: string,
  table: ScapulaPredictionTable = DEFAULT_SCAPULA_PREDICTIONS,
): PredictedError[] {
  const byCode = new Map<string, string[]>();
  for (const p of table.predictions) {
    if (p.exercises && !p.exercises.includes(exerciseId)) continue;
    const x = features[p.feature];
    if (x === undefined) continue;
    if ((p.min !== undefined && x < p.min) || (p.max !== undefined && x > p.max)) {
      for (const code of p.predicts) byCode.set(code, [...(byCode.get(code) ?? []), p.id]);
    }
  }
  return [...byCode].map(([errorCode, because]) => ({ errorCode, because }));
}
