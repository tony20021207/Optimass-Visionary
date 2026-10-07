import type { Joint, JointAction, JointId, Muscle, NumericRange } from "@optimass/types";

export const MODULE = "M1" as const;

/** In-memory knowledge base built from content/anatomy. */
export interface AnatomyKb {
  muscles: readonly Muscle[];
  joints: readonly Joint[];
}

const notImplemented = (fn: string): never => {
  throw new Error(`${fn} is not implemented yet (M1, see docs/specs/M1.md)`);
};

/** Loads and validates content/anatomy into an AnatomyKb. */
export function loadAnatomyKb(_contentDir: string): AnatomyKb {
  return notImplemented("loadAnatomyKb");
}

/** Muscles with an action at `joint` matching `action`. */
export function musclesActingOn(_kb: AnatomyKb, _joint: JointId, _action: JointAction): Muscle[] {
  return notImplemented("musclesActingOn");
}

/** Normative ROM for a joint motion, or undefined when content has none. */
export function romNorm(_kb: AnatomyKb, _joint: JointId, _action: JointAction): NumericRange | undefined {
  return notImplemented("romNorm");
}
