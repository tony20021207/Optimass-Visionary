// Recommended grip width from the lifter's own arm lengths instead of a fixed multiple of shoulder width.
//
// Seen from the front at the bottom of the rep, each hand sits out from its shoulder joint by the upper arm's
// sideways reach plus the forearm's:
//   grip = shoulder width + 2·upperArm·sin(θ) + 2·forearm·sin(φ)
//   bar height above the shoulders ≈ forearm·cos(φ) − upperArm·cos(θ)
// θ = upper arm angle out from the trunk at the bottom, φ = forearm tilt from vertical in the front view (+ = hands
// outside the elbows). Distances are joint centre to joint centre (MediaPipe shoulders, elbows, wrists).
//
// Tony wants the forearms on the line of pull (vertical in the front view) over the bottom ~80% of the pull, not just
// at the bottom. With the hands fixed on the bar that can't hold exactly: on a wide-grip pull the elbows swing out
// further at mid-pull (up to ~0.93 upper-arm lengths from the shoulder on the synthetic lifter) than at the bottom
// (sin θ). The best fit puts each hand under the middle of that swing:
//   grip = shoulder width + upperArm·(sin θ + midPullElbowReach) + 2·forearm·sin(φ)
// which keeps the front-view forearm within about ±10° over the bottom 80% on the synthetic lifter (2.2×).
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
  /** φ: extra forearm tilt from vertical, front view (+ = hands outside the elbows). 0 = on the line of pull. */
  forearmTiltDeg: number;
  /**
   * Widest sideways elbow reach during the pull, in upper-arm lengths from the shoulder. When set, the hands go under
   * the middle of the elbow's swing (best fit over the bottom of the pull); when absent, under the elbow at the bottom.
   */
  midPullElbowReach?: number;
}

/**
 * PLACEHOLDER: best fit over the bottom of the pull, with Tony's 42° bottom arm angle. midPullElbowReach 0.93 is read
 * off the synthetic lifter's elbow path, not measured on people; a real clip can replace it with the lifter's own.
 */
export const DEFAULT_GRIP_RULE: GripRule = { bottomArmElevationDeg: 42, forearmTiltDeg: 0, midPullElbowReach: 0.93 };

export interface RecommendedGrip {
  /** Wrist to wrist (m). */
  gripWidthM: number;
  /** Wrist to wrist ÷ shoulder joint to shoulder joint, comparable with the grip_width_x_shoulder feature. */
  gripWidthXShoulder: number;
  /** Where the wrists end up at the bottom relative to the shoulders with the forearm tilt φ (m, + = above). */
  barAboveShouldersM: number;
}

const rad = (d: number) => (d * Math.PI) / 180;

export function recommendedGrip(arms: ArmDimensions, rule: GripRule = DEFAULT_GRIP_RULE): RecommendedGrip {
  const theta = rad(rule.bottomArmElevationDeg);
  const phi = rad(rule.forearmTiltDeg);
  const elbowOut = rule.midPullElbowReach === undefined ? 2 * Math.sin(theta) : Math.sin(theta) + rule.midPullElbowReach;
  const gripWidthM = arms.shoulderWidthM + arms.upperArmM * elbowOut + 2 * arms.forearmM * Math.sin(phi);
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
