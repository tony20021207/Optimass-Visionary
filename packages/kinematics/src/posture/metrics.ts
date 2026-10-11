// Static standing-posture measurements from MediaPipe world landmarks. Geometry only; judging is in evaluate.ts.
import { POSE_LANDMARK, type PoseLandmarkName, type PoseSequence } from "@optimass/types";
import { CAPTURE_PROTOCOL } from "../camera";
import { mean } from "../signal";
import { dot, jointAngleDeg, mid, RAD_TO_DEG, rejectFrom, sub, unit, v, type Vec3 } from "../vec3";
import type { PostureCapture, PostureViewId } from "./synth";

/** Each feature, the plane it lives in (which decides which views are trusted), and what it means. */
export const POSTURE_FEATURES = {
  head_forward_m: { plane: "sagittal", label: "Ears ahead of the shoulders (m, + = forward)" },
  shoulders_forward_m: { plane: "sagittal", label: "Shoulders ahead of the hips (m, + = forward)" },
  left_knee_hyperextension_deg: { plane: "sagittal", label: "Left knee past straight (deg, + = hyperextended)" },
  right_knee_hyperextension_deg: { plane: "sagittal", label: "Right knee past straight (deg, + = hyperextended)" },
  head_tilt_deg: { plane: "frontal", label: "Ear line tilt (deg, + = left ear higher)" },
  shoulder_tilt_deg: { plane: "frontal", label: "Shoulder line tilt (deg, + = left shoulder higher)" },
  pelvic_tilt_deg: { plane: "frontal", label: "Hip line tilt (deg, + = left hip higher). Hip joint landmarks, not the iliac crests." },
  trunk_lateral_shift_m: { plane: "frontal", label: "Shoulders shifted sideways over the hips (m, + = to the left)" },
  // Angle versions of the distances above, so the same limit holds for any body size (Tony, 2026-10-10).
  head_forward_deg: { plane: "sagittal", label: "Ears ahead of the shoulders, as the shoulder-to-ear line's angle from vertical (deg, + = forward)" },
  shoulders_forward_deg: { plane: "sagittal", label: "Shoulders ahead of the hips, as the trunk line's angle from vertical (deg, + = forward)" },
  trunk_lateral_shift_deg: { plane: "frontal", label: "Shoulders shifted sideways over the hips, as the trunk line's angle from vertical (deg, + = to the left)" },
  left_knee_valgus_deg: { plane: "frontal", label: "Left knee inside the hip-ankle line (deg, + = valgus)" },
  right_knee_valgus_deg: { plane: "frontal", label: "Right knee inside the hip-ankle line (deg, + = valgus)" },
} as const;
export type PostureFeature = keyof typeof POSTURE_FEATURES;
export type PostureFeatures = Record<PostureFeature, number>;

const UP = v(0, -1, 0); // MediaPipe world y points down; assumes a level camera

/** Averages each world landmark over the clip (the lifter is standing still). */
function stillPose(seq: PoseSequence): Record<PoseLandmarkName, Vec3> {
  const out = {} as Record<PoseLandmarkName, Vec3>;
  for (const [name, i] of Object.entries(POSE_LANDMARK) as [PoseLandmarkName, number][]) {
    const pts = seq.frames.map((f) => f.worldLandmarks[i]!);
    out[name] = v(mean(pts.map((p) => p.x)), mean(pts.map((p) => p.y)), mean(pts.map((p) => p.z)));
  }
  return out;
}

const tiltDeg = (left: Vec3, right: Vec3, lateral: Vec3) => {
  const d = sub(left, right);
  return Math.atan2(dot(d, UP), dot(d, lateral)) * RAD_TO_DEG;
};

/** Knee bend out of the hip–ankle line within one plane (the plane whose normal is `normal`), signed toward `positive`. */
function kneeDeviationDeg(hip: Vec3, knee: Vec3, ankle: Vec3, normal: Vec3, positive: Vec3): number {
  const [h, k, a] = [hip, knee, ankle].map((p) => rejectFrom(p, normal)) as [Vec3, Vec3, Vec3];
  const bend = 180 - jointAngleDeg(h, k, a);
  const offset = rejectFrom(sub(k, h), sub(a, h));
  return Math.sign(dot(offset, positive)) * bend;
}

/** Measures every posture feature from one still capture, whatever the view. Use `postureScreen` to pick trusted views. */
export function postureFeatures(seq: PoseSequence): PostureFeatures {
  const p = stillPose(seq);
  const forward = unit(rejectFrom(sub(mid(p.left_foot_index, p.right_foot_index), mid(p.left_heel, p.right_heel)), UP));
  const left = unit(rejectFrom(sub(p.left_hip, p.right_hip), UP));
  const shoulderMid = mid(p.left_shoulder, p.right_shoulder);
  const hipMid = mid(p.left_hip, p.right_hip);
  const earMid = mid(p.left_ear, p.right_ear);
  const back = v(-forward.x, -forward.y, -forward.z);
  const right = v(-left.x, -left.y, -left.z);
  return {
    head_forward_m: dot(sub(earMid, shoulderMid), forward),
    shoulders_forward_m: dot(sub(shoulderMid, hipMid), forward),
    left_knee_hyperextension_deg: kneeDeviationDeg(p.left_hip, p.left_knee, p.left_ankle, left, back),
    right_knee_hyperextension_deg: kneeDeviationDeg(p.right_hip, p.right_knee, p.right_ankle, left, back),
    head_tilt_deg: tiltDeg(p.left_ear, p.right_ear, left),
    shoulder_tilt_deg: tiltDeg(p.left_shoulder, p.right_shoulder, left),
    pelvic_tilt_deg: tiltDeg(p.left_hip, p.right_hip, left),
    trunk_lateral_shift_m: dot(sub(shoulderMid, hipMid), left),
    head_forward_deg: Math.atan2(dot(sub(earMid, shoulderMid), forward), dot(sub(earMid, shoulderMid), UP)) * RAD_TO_DEG,
    shoulders_forward_deg: Math.atan2(dot(sub(shoulderMid, hipMid), forward), dot(sub(shoulderMid, hipMid), UP)) * RAD_TO_DEG,
    trunk_lateral_shift_deg: Math.atan2(dot(sub(shoulderMid, hipMid), left), dot(sub(shoulderMid, hipMid), UP)) * RAD_TO_DEG,
    // Medial is toward the midline: rightward for the left knee, leftward for the right knee.
    left_knee_valgus_deg: kneeDeviationDeg(p.left_hip, p.left_knee, p.left_ankle, forward, right),
    right_knee_valgus_deg: kneeDeviationDeg(p.right_hip, p.right_knee, p.right_ankle, forward, left),
  };
}

/** Views trusted for each plane: side views for sagittal features, front/back for frontal ones. */
export const TRUSTED_VIEWS: Record<"sagittal" | "frontal", PostureViewId[]> = {
  sagittal: ["left", "right"],
  frontal: ["anterior", "posterior"],
};

export interface PostureFeatureResult {
  value: number;
  /** Value from every view, trusted or not, to show how much the camera angle changes it. */
  perView: Partial<Record<PostureViewId, number>>;
  /** Max minus min across the trusted views. A big spread means the captures disagree. */
  trustedSpread: number;
}

export function postureScreen(captures: PostureCapture[]): Record<PostureFeature, PostureFeatureResult> {
  const byView = captures.map((c) => ({ view: c.view, features: postureFeatures(c.sequence) }));
  const out = {} as Record<PostureFeature, PostureFeatureResult>;
  for (const feature of Object.keys(POSTURE_FEATURES) as PostureFeature[]) {
    const trusted = TRUSTED_VIEWS[POSTURE_FEATURES[feature].plane];
    const perView = Object.fromEntries(byView.map((b) => [b.view, b.features[feature]]));
    const values = byView.filter((b) => trusted.includes(b.view)).map((b) => b.features[feature]);
    if (values.length === 0) throw new Error(`posture screen: no ${trusted.join("/")} capture for ${feature}`);
    out[feature] = { value: mean(values), perView, trustedSpread: Math.max(...values) - Math.min(...values) };
  }
  return out;
}

export const POSTURE_VIEW_IDS = CAPTURE_PROTOCOL.postureScreen.views.map((x) => x.id);
