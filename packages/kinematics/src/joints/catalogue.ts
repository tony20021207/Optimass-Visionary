// Clinical joint motions shared by every exercise (Tony, 2026-10-10): one vocabulary for simulating a lift, for the
// angles measured from video, and for the rules that judge them. Each motion is one axis with a named positive and
// negative direction, e.g. shoulder flexion (+) / extension (−).
//
// Angles are of the distal segment relative to the proximal one (shoulder = humerus vs thorax, i.e. humerothoracic;
// elbow = forearm vs humerus). Zero is anatomical position. `displayRange` only bounds sliders and plots; it is NOT a
// clinical norm.

export type JointRegion = "trunk" | "neck" | "scapula" | "shoulder" | "elbow" | "forearm" | "wrist" | "hip" | "knee" | "ankle";

export interface JointMotion {
  region: JointRegion;
  /** What + and − mean, in clinical words. */
  positive: string;
  negative: string;
  unit: "deg" | "m";
  displayRange: readonly [number, number];
  /** How it's defined here, where that isn't obvious from the name. */
  note?: string;
}

export const JOINT_MOTIONS = {
  trunk_flexion: {
    region: "trunk",
    positive: "flexion",
    negative: "extension",
    unit: "deg",
    displayRange: [-45, 45],
    note: "Trunk line (hip midpoint to shoulder midpoint) from vertical in the sagittal plane; leaning back is extension.",
  },
  trunk_lateral_flexion: { region: "trunk", positive: "left lateral flexion", negative: "right lateral flexion", unit: "deg", displayRange: [-30, 30] },
  trunk_rotation: { region: "trunk", positive: "left rotation", negative: "right rotation", unit: "deg", displayRange: [-45, 45] },
  scapular_elevation: {
    region: "scapula",
    positive: "elevation",
    negative: "depression",
    unit: "m",
    displayRange: [-0.06, 0.1],
    note: "Shoulder joint centre along the trunk line. MediaPipe has no scapula points; this is read from the shoulder landmark.",
  },
  scapular_protraction: {
    region: "scapula",
    positive: "protraction",
    negative: "retraction",
    unit: "m",
    displayRange: [-0.05, 0.05],
    note: "Shoulder joint centre gliding forward around the ribcage (−: back and toward the spine).",
  },
  scapular_upward_rotation: {
    region: "scapula",
    positive: "upward rotation",
    negative: "downward rotation",
    unit: "deg",
    displayRange: [-40, 60],
    note: "Not visible to MediaPipe; in the simulation it swings the shoulder joint centre around the scapula.",
  },
  shoulder_flexion: {
    region: "shoulder",
    positive: "flexion",
    negative: "extension",
    unit: "deg",
    displayRange: [-60, 180],
    note: "Humerus vs thorax in the sagittal plane: 0 = arm at the side, 90 = forward, 180 = overhead.",
  },
  shoulder_abduction: {
    region: "shoulder",
    positive: "abduction",
    negative: "adduction",
    unit: "deg",
    displayRange: [-30, 120],
    note: "Humerus out of the sagittal plane, toward the side: 0 = in the sagittal plane.",
  },
  shoulder_external_rotation: {
    region: "shoulder",
    positive: "external rotation",
    negative: "internal rotation",
    unit: "deg",
    displayRange: [-90, 120],
    note:
      "Forearm direction around the humerus (elbow bent), 0 = forearm pointing where it would in anatomical position " +
      "carried through the flexion and abduction. Closed chain (hands on a bar): set by where the elbow sits, so it is a " +
      "result, not an input. Not readable with a near-straight elbow.",
  },
  elbow_flexion: { region: "elbow", positive: "flexion", negative: "extension (hyperextension)", unit: "deg", displayRange: [-10, 150] },
  forearm_pronation: { region: "forearm", positive: "pronation", negative: "supination", unit: "deg", displayRange: [-90, 90] },
  wrist_flexion: { region: "wrist", positive: "flexion", negative: "extension", unit: "deg", displayRange: [-70, 80] },
  wrist_radial_deviation: { region: "wrist", positive: "radial deviation", negative: "ulnar deviation", unit: "deg", displayRange: [-35, 25] },
  hip_flexion: { region: "hip", positive: "flexion", negative: "extension", unit: "deg", displayRange: [-30, 130] },
  hip_abduction: { region: "hip", positive: "abduction", negative: "adduction", unit: "deg", displayRange: [-30, 50] },
  hip_external_rotation: { region: "hip", positive: "external rotation", negative: "internal rotation", unit: "deg", displayRange: [-45, 60] },
  knee_flexion: { region: "knee", positive: "flexion", negative: "extension (hyperextension)", unit: "deg", displayRange: [-15, 150] },
  ankle_dorsiflexion: { region: "ankle", positive: "dorsiflexion", negative: "plantarflexion", unit: "deg", displayRange: [-50, 30] },
  neck_flexion: { region: "neck", positive: "flexion", negative: "extension", unit: "deg", displayRange: [-60, 60] },
} as const satisfies Record<string, JointMotion>;
export type JointMotionId = keyof typeof JOINT_MOTIONS;

/** "Shoulder flexion (+) / extension (−)" */
export function jointMotionLabel(id: JointMotionId): string {
  const m: JointMotion = JOINT_MOTIONS[id];
  const region = m.region.charAt(0).toUpperCase() + m.region.slice(1);
  return `${region} ${m.positive} (+) / ${m.negative} (−)${m.unit === "m" ? ", m" : ", °"}`;
}
