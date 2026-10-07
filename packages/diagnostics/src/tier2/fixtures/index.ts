// Tier 1 findings for the lat pulldown, used as Tier 2 input until the vision lane's Tier 1 rules emit real ones.
// Hand-written, not produced from a clip. Evidence values are zeroed placeholders; only the error codes matter here.
import { z } from "zod";
import { KinematicFinding } from "@optimass/types";
import sagittalJson from "./pulldown-sagittal-findings.json";
import frontalJson from "./pulldown-frontal-findings.json";

/** Side view: low back arches overhead, short top range, some torso lean on the last rep. */
export const pulldownSagittalFindings: KinematicFinding[] = z.array(KinematicFinding).parse(sagittalJson);
/** Front view: shoulders shrug through the pull, left side leads. */
export const pulldownFrontalFindings: KinematicFinding[] = z.array(KinematicFinding).parse(frontalJson);
