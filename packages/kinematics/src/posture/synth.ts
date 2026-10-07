// Synthetic standing-posture captures for the 4-view posture check. Made-up geometry for testing the math:
// NOT recordings and NOT clinical references.
import type { PoseSequence } from "@optimass/types";
import { CAPTURE_PROTOCOL, type CameraPlacement } from "../camera";
import { renderSequence, type Body } from "../synth-render";
import { add, v } from "../vec3";

export interface PostureProfile {
  /** Ears this far ahead of the shoulders (m). */
  forwardHeadM: number;
  /** Shoulders this far ahead of the hips (m). */
  shouldersForwardM: number;
  /** Right shoulder this much lower than the left (m). */
  rightShoulderDropM: number;
  /** Right hip this much lower than the left (m). */
  rightHipDropM: number;
  /** Knees pushed medially by this frontal-plane angle (deg), both sides. */
  kneeValgusDeg: number;
  /** Knees pushed back past straight by this sagittal-plane angle (deg), both sides. */
  kneeHyperextensionDeg: number;
  noiseM: number;
  seed: number;
}

export const NEUTRAL_POSTURE: PostureProfile = {
  forwardHeadM: 0,
  shouldersForwardM: 0,
  rightShoulderDropM: 0,
  rightHipDropM: 0,
  kneeValgusDeg: 0,
  kneeHyperextensionDeg: 0,
  noiseM: 0.004,
  seed: 11,
};

export const POSTURE_VARIANTS = {
  neutral: NEUTRAL_POSTURE,
  forward_head: { ...NEUTRAL_POSTURE, forwardHeadM: 0.07, seed: 12 },
  rounded_shoulders: { ...NEUTRAL_POSTURE, shouldersForwardM: 0.07, seed: 13 },
  shoulder_drop: { ...NEUTRAL_POSTURE, rightShoulderDropM: 0.035, seed: 14 },
  pelvic_drop: { ...NEUTRAL_POSTURE, rightHipDropM: 0.03, seed: 15 },
  knee_valgus: { ...NEUTRAL_POSTURE, kneeValgusDeg: 12, seed: 16 },
  knee_hyperextension: { ...NEUTRAL_POSTURE, kneeHyperextensionDeg: 10, seed: 17 },
} satisfies Record<string, PostureProfile>;
export type PostureVariant = keyof typeof POSTURE_VARIANTS;

export const STANDING_HIP_HEIGHT_M = 0.94;
export const STANDING_WAIST_HEIGHT_M = 1.0;
const THIGH = 0.43;
const SHIN = 0.43; // same body as the synthetic pulldown lifter, so one calibration fits both
const rad = (d: number) => (d * Math.PI) / 180;

export function standingPose(p: PostureProfile): Body {
  const pose = {} as Body;
  const legBend = (deg: number) => Math.tan(rad(deg / 2)) * ((THIGH + SHIN) / 2);
  for (const [side, s] of [["left", 1], ["right", -1]] as const) {
    const hip = v(s * 0.1, side === "left" ? p.rightHipDropM / 2 : -p.rightHipDropM / 2, 0);
    const ankle = v(s * 0.1, -(THIGH + SHIN), -0.02);
    const knee = v(s * (0.1 - legBend(p.kneeValgusDeg)), hip.y - THIGH, -0.01 - legBend(p.kneeHyperextensionDeg));
    const shoulderY = 0.5 + (side === "right" ? -p.rightShoulderDropM / 2 : p.rightShoulderDropM / 2);
    const shoulder = v(s * 0.2, shoulderY, p.shouldersForwardM);
    const elbow = add(shoulder, v(s * 0.03, -0.3, 0.02));
    const wrist = add(elbow, v(0, -0.27, 0.03));
    Object.assign(pose, {
      [`${side}_hip`]: hip,
      [`${side}_knee`]: knee,
      [`${side}_ankle`]: ankle,
      [`${side}_heel`]: add(ankle, v(0, -0.05, -0.05)),
      [`${side}_foot_index`]: add(ankle, v(s * 0.03, -0.07, 0.17)),
      [`${side}_shoulder`]: shoulder,
      [`${side}_elbow`]: elbow,
      [`${side}_wrist`]: wrist,
      [`${side}_index`]: add(wrist, v(0, -0.09, 0.01)),
      [`${side}_pinky`]: add(wrist, v(s * 0.02, -0.08, 0)),
      [`${side}_thumb`]: add(wrist, v(0, -0.05, 0.03)),
    });
  }
  const head = v(0, 0.5 + 0.2, p.shouldersForwardM + p.forwardHeadM);
  const at = (x: number, y: number, z: number) => add(head, v(x, y, z));
  pose.nose = at(0, 0, 0.1);
  for (const [side, s] of [["left", 1], ["right", -1]] as const) {
    pose[`${side}_eye_inner`] = at(s * 0.02, 0.03, 0.085);
    pose[`${side}_eye`] = at(s * 0.035, 0.03, 0.08);
    pose[`${side}_eye_outer`] = at(s * 0.05, 0.03, 0.075);
    pose[`${side}_ear`] = at(s * 0.075, 0, 0);
  }
  pose.mouth_left = at(0.025, -0.04, 0.09);
  pose.mouth_right = at(-0.025, -0.04, 0.09);
  return pose;
}

export type PostureViewId = (typeof CAPTURE_PROTOCOL.postureScreen.views)[number]["id"];

export interface PostureCapture {
  view: PostureViewId;
  sequence: PoseSequence;
}

/** One still capture per protocol view (front, back, left, right), each `holdSeconds` long. */
export function synthesizePostureScreen(profile: PostureProfile, fps = 30): PostureCapture[] {
  const pose = standingPose(profile);
  return CAPTURE_PROTOCOL.postureScreen.views.map((view, k) => {
    const camera: CameraPlacement = { azimuthDeg: view.azimuthDeg, heightM: STANDING_WAIST_HEIGHT_M, distanceM: 3 };
    return {
      view: view.id,
      sequence: renderSequence({
        id: `synthetic-posture-${view.id}`,
        exerciseId: "posture_screen",
        fps,
        frameCount: Math.round(CAPTURE_PROTOCOL.postureScreen.holdSeconds * fps),
        poseAtFrame: () => pose,
        camera,
        hipHeightM: STANDING_HIP_HEIGHT_M,
        noiseM: profile.noiseM,
        seed: profile.seed * 10 + k,
      }),
    };
  });
}
