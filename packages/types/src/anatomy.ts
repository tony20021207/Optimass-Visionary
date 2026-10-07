import { z } from "zod";
import { NumericRange, Plane, Slug } from "./common";

export const JointId = z.enum([
  "ankle",
  "subtalar",
  "knee",
  "hip",
  "lumbar_spine",
  "thoracic_spine",
  "cervical_spine",
  "scapulothoracic",
  "glenohumeral",
  "elbow",
  "radioulnar",
  "wrist",
]);
export type JointId = z.infer<typeof JointId>;

export const JointAction = z.enum([
  "flexion",
  "extension",
  "abduction",
  "adduction",
  "internal_rotation",
  "external_rotation",
  "horizontal_abduction",
  "horizontal_adduction",
  "dorsiflexion",
  "plantarflexion",
  "inversion",
  "eversion",
  "pronation",
  "supination",
  "lateral_flexion",
  "rotation",
  "elevation",
  "depression",
  "protraction",
  "retraction",
  "upward_rotation",
  "downward_rotation",
]);
export type JointAction = z.infer<typeof JointAction>;

export const JointMotion = z.object({
  action: JointAction,
  plane: Plane,
  /** Normative active ROM in degrees. Authored in content/anatomy; never hard-coded. */
  romNormDeg: NumericRange.optional(),
});
export type JointMotion = z.infer<typeof JointMotion>;

export const Joint = z.object({
  id: JointId,
  name: z.string().min(1),
  motions: z.array(JointMotion).min(1),
});
export type Joint = z.infer<typeof Joint>;

export const MuscleRole = z.enum(["prime_mover", "synergist", "stabilizer"]);
export type MuscleRole = z.infer<typeof MuscleRole>;

export const MuscleAction = z.object({
  joint: JointId,
  action: JointAction,
  plane: Plane,
  role: MuscleRole,
});
export type MuscleAction = z.infer<typeof MuscleAction>;

export const MuscleRegion = z.enum(["chest", "back", "shoulders", "arms", "forearms", "core", "hips", "thighs", "lower_legs", "neck"]);
export type MuscleRegion = z.infer<typeof MuscleRegion>;

export const Muscle = z.object({
  id: Slug,
  name: z.string().min(1),
  region: MuscleRegion,
  /** Parent muscle id when this entry is a head or region (e.g. long head of triceps). */
  parentId: Slug.optional(),
  attachments: z.object({
    origin: z.array(z.string().min(1)).min(1),
    insertion: z.array(z.string().min(1)).min(1),
  }),
  actions: z.array(MuscleAction).min(1),
  /** Joints crossed; more than one means the muscle is multi-articular and its length depends on several joints. */
  crossesJoints: z.array(JointId).min(1),
  innervation: z.string().optional(),
  lengthTensionNotes: z.string().optional(),
});
export type Muscle = z.infer<typeof Muscle>;
