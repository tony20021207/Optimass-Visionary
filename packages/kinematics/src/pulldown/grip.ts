// Recommended grip width from the lifter's own arm lengths instead of a fixed multiple of shoulder width.
//
// Seen from the front at the bottom of the rep, each hand sits out from its shoulder joint by the upper arm's
// sideways reach plus the forearm's:
//   grip = shoulder width + 2·upperArm·sin(θ) + 2·forearm·sin(φ)
//   bar height above the shoulders ≈ forearm·cos(φ) − upperArm·cos(θ)
// θ = upper arm angle out from the trunk at the bottom, φ = forearm tilt from vertical in the front view (+ = hands
// outside the elbows). Distances are joint centre to joint centre (MediaPipe shoulders, elbows, wrists).
import type { Skeleton } from "../body";

export interface ArmDimensions {
  /** Shoulder joint centre to shoulder joint centre (m). */
  shoulderWidthM: number;
  upperArmM: number;
  /** Elbow to wrist (m). */
  forearmM: number;
}

export interface GripRule {
  /** θ: upper arm angle from the trunk's downward axis at the bottom (Tony's standard: 42°, 2026-10-09). */
  bottomArmElevationDeg: number;
  /** φ: forearm tilt from vertical at the bottom, front view. 0 = vertical forearms. */
  forearmTiltDeg: number;
}

/**
 * PLACEHOLDER rule until Tony picks φ: vertical forearms (the classic cue) with his 42° bottom arm angle. His current
 * 2.2× baseline corresponds to φ ≈ 9° on the synthetic lifter.
 */
export const DEFAULT_GRIP_RULE: GripRule = { bottomArmElevationDeg: 42, forearmTiltDeg: 0 };

export interface RecommendedGrip {
  /** Wrist to wrist (m). */
  gripWidthM: number;
  /** Wrist to wrist ÷ shoulder joint to shoulder joint, comparable with the grip_width_x_shoulder feature. */
  gripWidthXShoulder: number;
  /** Where that grip leaves the wrists at the bottom, relative to the shoulders (m, + = above). */
  barAboveShouldersM: number;
}

const rad = (d: number) => (d * Math.PI) / 180;

export function recommendedGrip(arms: ArmDimensions, rule: GripRule = DEFAULT_GRIP_RULE): RecommendedGrip {
  const theta = rad(rule.bottomArmElevationDeg);
  const phi = rad(rule.forearmTiltDeg);
  const gripWidthM = arms.shoulderWidthM + 2 * arms.upperArmM * Math.sin(theta) + 2 * arms.forearmM * Math.sin(phi);
  return {
    gripWidthM,
    gripWidthXShoulder: gripWidthM / arms.shoulderWidthM,
    barAboveShouldersM: arms.forearmM * Math.cos(phi) - arms.upperArmM * Math.cos(theta),
  };
}

/** Arm dimensions from the posture-check skeleton (left/right averaged). */
export function armDimensionsFromSkeleton(skeleton: Skeleton): ArmDimensions {
  const s = skeleton.segments;
  return {
    shoulderWidthM: s.shoulder_width.lengthM,
    upperArmM: (s.left_upper_arm.lengthM + s.right_upper_arm.lengthM) / 2,
    forearmM: (s.left_forearm.lengthM + s.right_forearm.lengthM) / 2,
  };
}
