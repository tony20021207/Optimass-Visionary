// Shared test fixtures. Pose sequences are synthetic stick figures from scripts/generate-fixtures.mjs:
// good for exercising engines and UI, never a clinical reference. Clinical values in the report are placeholders.
import { DiagnosticReport, PoseSequence } from "../index";
import squatSagittalJson from "./squat-sagittal-2reps.json";
import squatFrontalJson from "./squat-frontal-valgus.json";
import standingJson from "./standing-frontal-static.json";
import reportJson from "./diagnostic-report-squat-frontal.json";

/** Side view, 2 back-squat reps, 15 fps. */
export const squatSagittal2Reps: PoseSequence = PoseSequence.parse(squatSagittalJson);
/** Front view, 2 back-squat reps; rep 0 tracks well, rep 1 has medial knee collapse at depth. */
export const squatFrontalValgus: PoseSequence = PoseSequence.parse(squatFrontalJson);
/** Front view, 1 s standing still. Useful for "no reps" and smoothing tests. */
export const standingFrontalStatic: PoseSequence = PoseSequence.parse(standingJson);
/** A complete three-tier report for the frontal squat clip, with placeholder clinical content. */
export const diagnosticReportSquatFrontal: DiagnosticReport = DiagnosticReport.parse(reportJson);

export const poseSequences = [squatSagittal2Reps, squatFrontalValgus, standingFrontalStatic] as const;
