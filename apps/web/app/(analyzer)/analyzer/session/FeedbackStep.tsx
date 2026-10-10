"use client";

import { useState } from "react";
import { Button, cn } from "@optimass/ui";
import type { CoachingTable, RomPhase, SetFeedback } from "@optimass/diagnostics";
import { ActionBar } from "./controls";
import type { PhaseClip } from "./demo-analysis";
import { DiscomfortMarker } from "./DiscomfortMarker";
import type { DiscomfortNote } from "./DiscomfortMarker";
import { MuscleMarker } from "./MuscleMarker";
import type { MuscleMark } from "./MuscleMarker";
import type { RepClip } from "./RepVideo";

/** Marks are kept per phase; "whole" is used when there's no chosen rep and the lifter reviews the whole set. */
type PhaseKey = RomPhase | "whole";

interface Part {
  key: PhaseKey;
  clip: PhaseClip | null;
}

interface Step {
  part: number;
  kind: "muscles" | "pain";
}

export function FeedbackStep({
  setNumber,
  videoUrl,
  rep,
  phaseClips,
  repCount,
  coaching,
  onBack,
  onSubmit,
}: {
  setNumber: number;
  videoUrl: string;
  /** The rep closest to good form, or null to review the whole set. */
  rep: RepClip | null;
  /** That rep cut into thirds of the range; reviewed one at a time, muscles then pain in each. */
  phaseClips: PhaseClip[] | null;
  repCount: number;
  coaching: CoachingTable;
  onBack: () => void;
  onSubmit: (feedback: SetFeedback) => void;
}) {
  const muscles = coaching.feel.muscles;
  const parts: Part[] = phaseClips ? phaseClips.map((c) => ({ key: c.phase, clip: c })) : [{ key: "whole", clip: null }];
  const steps: Step[] = parts.flatMap((_, part) => [
    { part, kind: "muscles" as const },
    { part, kind: "pain" as const },
  ]);

  const [stepIndex, setStepIndex] = useState(0);
  const [marks, setMarks] = useState<Partial<Record<PhaseKey, Record<string, MuscleMark>>>>({});
  const [notes, setNotes] = useState<Partial<Record<PhaseKey, DiscomfortNote[]>>>({});
  const [wholeSetForPain, setWholeSetForPain] = useState(false);

  const step = steps[stepIndex]!;
  const part = parts[step.part]!;
  const partMarks = marks[part.key] ?? {};
  const partNotes = notes[part.key] ?? [];
  const isLast = stepIndex === steps.length - 1;

  const submit = () =>
    onSubmit({
      rep: rep ?? undefined,
      muscles: Object.fromEntries(
        muscles.map((m) => {
          const felt = parts.flatMap((p) => (marks[p.key]?.[m.id] ? [[p.key, marks[p.key]![m.id]!] as const] : []));
          if (felt.length === 0) return [m.id, { felt: false }];
          const rating = Math.max(...felt.map(([, mark]) => mark.rating));
          const byPhase = phaseClips ? Object.fromEntries(felt) : undefined;
          return [m.id, { felt: true, rating, byPhase }];
        }),
      ),
      discomfort: parts.flatMap((p) =>
        (notes[p.key] ?? []).map((n) => ({
          id: n.id,
          timeSec: n.timeSec,
          point: n.point,
          phase: p.key === "whole" ? undefined : p.key,
          areaId: n.areaId,
          note: n.note,
        })),
      ),
    });

  const next = () => {
    setWholeSetForPain(false);
    if (isLast) submit();
    else setStepIndex((i) => i + 1);
  };

  const nextLabel =
    step.kind === "muscles"
      ? Object.keys(partMarks).length === 0
        ? "Didn't feel anything here"
        : "Next: any pain?"
      : partNotes.length === 0
        ? isLast
          ? "No pain, see my cues"
          : "No pain here, next"
        : isLast
          ? "See my cues"
          : "Next part";

  return (
    <section className="space-y-4" aria-labelledby="feedback-question">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Set {setNumber}
          {part.clip ? ` · part ${step.part + 1} of ${parts.length}` : ""}
        </p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={`${s.part}-${s.kind}`}
              className={cn("h-1 flex-1 rounded-full", i <= stepIndex ? "bg-brand-600" : "bg-border", s.kind === "pain" && "mr-1.5 last:mr-0")}
            />
          ))}
        </div>
        {part.clip && <p className="mt-3 text-sm font-semibold text-brand-700">{PART_TITLE[part.clip.phase]}</p>}
        <h2 id="feedback-question" className={cn("text-lg font-semibold text-ink", part.clip ? "mt-0.5" : "mt-3")}>
          {step.kind === "muscles" ? "Which muscles were working?" : "Any pain or discomfort?"}
        </h2>
      </div>

      {step.kind === "muscles" && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            {stepIndex === 0 && rep ? (
              <>
                This is rep {rep.repIndex + 1} of {repCount}, your closest to good form, shown a third at a time. Each clip loops through that
                part of the pull and back.{" "}
              </>
            ) : null}
            Pause where you feel a muscle working, press <span className="font-medium text-ink">Mark a muscle</span>, tap the spot on your
            body, then say which muscle and how strongly.
          </p>
          <MuscleMarker
            key={part.key}
            videoUrl={videoUrl}
            clip={part.clip}
            muscles={muscles}
            marks={partMarks}
            onChange={(m) => setMarks((all) => ({ ...all, [part.key]: m }))}
          />
        </div>
      )}

      {step.kind === "pain" && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            If anything hurt {part.clip ? "in this part" : "during the set"}, pause there, press{" "}
            <span className="font-medium text-ink">Mark where it hurt</span>, tap the spot, then tell us how it felt.
          </p>
          {part.clip && (
            <button type="button" className="text-sm font-medium text-brand-700 underline" onClick={() => setWholeSetForPain((w) => !w)}>
              {wholeSetForPain ? "Back to this part of the rep" : "It happened on a different rep"}
            </button>
          )}
          <DiscomfortMarker
            key={`${part.key}-${wholeSetForPain}`}
            videoUrl={videoUrl}
            clip={wholeSetForPain ? null : part.clip}
            areas={coaching.discomfort.areas}
            notes={partNotes}
            onChange={(n) => setNotes((all) => ({ ...all, [part.key]: n }))}
          />
        </div>
      )}

      <ActionBar>
        <Button variant="ghost" onClick={() => (stepIndex === 0 ? onBack() : setStepIndex((i) => i - 1))}>
          Back
        </Button>
        <Button className="flex-1" onClick={next}>
          {nextLabel}
        </Button>
      </ActionBar>
    </section>
  );
}

const PART_TITLE: Record<RomPhase, string> = {
  first_third: "Part 1 · first third of the pull",
  middle_third: "Part 2 · middle third",
  last_third: "Part 3 · last third, into the bottom",
};
