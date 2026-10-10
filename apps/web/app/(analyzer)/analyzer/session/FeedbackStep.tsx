"use client";

import { useState } from "react";
import { Button, cn } from "@optimass/ui";
import type { CoachingTable, SetFeedback } from "@optimass/diagnostics";
import { ActionBar, Chip } from "./controls";
import { DiscomfortMarker } from "./DiscomfortMarker";
import type { DiscomfortNote } from "./DiscomfortMarker";
import { MuscleMarker } from "./MuscleMarker";
import type { MuscleMark } from "./MuscleMarker";
import type { RepClip } from "./RepVideo";

const QUESTIONS = ["Where did you feel it working?", "Any pain or discomfort?"] as const;

export function FeedbackStep({
  setNumber,
  videoUrl,
  rep,
  repCount,
  coaching,
  onBack,
  onSubmit,
}: {
  setNumber: number;
  videoUrl: string;
  /** The rep closest to good form, or null to review the whole set. */
  rep: RepClip | null;
  repCount: number;
  coaching: CoachingTable;
  onBack: () => void;
  onSubmit: (feedback: SetFeedback) => void;
}) {
  const muscles = coaching.feel.muscles;
  const [question, setQuestion] = useState(0);
  const [marks, setMarks] = useState<Record<string, MuscleMark>>({});
  const [hadDiscomfort, setHadDiscomfort] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<DiscomfortNote[]>([]);
  const [wholeSetForPain, setWholeSetForPain] = useState(false);

  const submit = () =>
    onSubmit({
      rep: rep ?? undefined,
      muscles: Object.fromEntries(
        muscles.map((m) => {
          const mark = marks[m.id];
          return [m.id, mark ? { felt: true, rating: mark.rating, timeSec: mark.timeSec, point: mark.point } : { felt: false }];
        }),
      ),
      discomfort: notes.map((n) => ({ id: n.id, timeSec: n.timeSec, point: n.point, areaId: n.areaId, note: n.note })),
    });

  const isLast = question === QUESTIONS.length - 1;

  return (
    <section className="space-y-4" aria-labelledby="feedback-question">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
          Set {setNumber} · question {question + 1} of {QUESTIONS.length}
        </p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {QUESTIONS.map((q, i) => (
            <span key={q} className={cn("h-1 flex-1 rounded-full", i <= question ? "bg-brand-600" : "bg-border")} />
          ))}
        </div>
        <h2 id="feedback-question" className="mt-3 text-lg font-semibold text-ink">
          {QUESTIONS[question]}
        </h2>
      </div>

      {question === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            {rep ? (
              <>
                This is rep {rep.repIndex + 1} of {repCount}, your closest to good form. It plays on a loop.{" "}
              </>
            ) : null}
            Pause where you felt a muscle working, press <span className="font-medium text-ink">Mark a muscle</span>, tap the spot on your
            body, then say which muscle and how strongly. Leave out anything you didn&apos;t feel.
          </p>
          <MuscleMarker videoUrl={videoUrl} rep={rep} muscles={muscles} marks={marks} onChange={setMarks} />
        </div>
      )}

      {question === 1 && (
        <div className="space-y-3">
          <div className="flex gap-2" role="group" aria-label="Any pain or discomfort?">
            <Chip on={hadDiscomfort === true} onClick={() => setHadDiscomfort(true)}>
              Yes
            </Chip>
            <Chip
              on={hadDiscomfort === false}
              onClick={() => {
                setHadDiscomfort(false);
                setNotes([]);
              }}
            >
              No
            </Chip>
          </div>
          {hadDiscomfort && (
            <>
              <p className="text-sm text-ink-muted">
                {rep && !wholeSetForPain ? "Same rep as before. " : ""}Pause where it hurt, press{" "}
                <span className="font-medium text-ink">Mark where it hurt</span>, tap the spot, then tell us how it felt.
              </p>
              {rep && (
                <button type="button" className="text-sm font-medium text-brand-700 underline" onClick={() => setWholeSetForPain((w) => !w)}>
                  {wholeSetForPain ? `Back to rep ${rep.repIndex + 1}` : "It happened on a different rep"}
                </button>
              )}
              <DiscomfortMarker
                videoUrl={videoUrl}
                rep={wholeSetForPain ? null : rep}
                areas={coaching.discomfort.areas}
                notes={notes}
                onChange={setNotes}
              />
            </>
          )}
        </div>
      )}

      <ActionBar>
        <Button variant="ghost" onClick={() => (question === 0 ? onBack() : setQuestion((q) => q - 1))}>
          Back
        </Button>
        <Button className="flex-1" onClick={() => (isLast ? submit() : setQuestion((q) => q + 1))}>
          {isLast ? "See my cues" : "Next"}
        </Button>
      </ActionBar>
    </section>
  );
}
