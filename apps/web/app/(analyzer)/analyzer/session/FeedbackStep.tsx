"use client";

import { useState } from "react";
import type { ButtonHTMLAttributes } from "react";
import { Button, Card, cn } from "@optimass/ui";
import type { CoachingTable, SetFeedback } from "@optimass/diagnostics";
import { DiscomfortMarker } from "./DiscomfortMarker";
import type { DiscomfortNote } from "./DiscomfortMarker";

type MuscleAnswer = { felt: boolean; rating?: number };

export function FeedbackStep({
  setNumber,
  videoUrl,
  coaching,
  onBack,
  onSubmit,
}: {
  setNumber: number;
  videoUrl: string;
  coaching: CoachingTable;
  onBack: () => void;
  onSubmit: (feedback: SetFeedback) => void;
}) {
  const [muscles, setMuscles] = useState<Record<string, MuscleAnswer>>({});
  const [hadDiscomfort, setHadDiscomfort] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<DiscomfortNote[]>([]);

  const answer = (id: string, patch: MuscleAnswer) => setMuscles((m) => ({ ...m, [id]: patch }));

  return (
    <div className="space-y-4">
      <Card title={`Set ${setNumber}: how did it feel?`}>
        <h3 className="mb-1 text-sm font-semibold text-ink">1. Did you feel the muscles working here?</h3>
        <p className="mb-3 text-sm text-ink-muted">2. If yes, how strongly, from 1 (barely) to 10 (very strongly)?</p>
        <ul className="divide-y divide-border">
          {coaching.feel.muscles.map((m) => {
            const a = muscles[m.id];
            return (
              <li key={m.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{m.label}</p>
                    <p className="text-xs text-ink-muted">{m.where}</p>
                  </div>
                  <div className="flex gap-1" role="group" aria-label={`Did you feel ${m.label}?`}>
                    <Toggle on={a?.felt === true} onClick={() => answer(m.id, { felt: true, rating: a?.rating })}>
                      Yes
                    </Toggle>
                    <Toggle on={a?.felt === false} onClick={() => answer(m.id, { felt: false })}>
                      No
                    </Toggle>
                  </div>
                </div>
                {a?.felt && (
                  <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={`How strongly did you feel ${m.label}?`}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <Toggle key={n} small on={a.rating === n} onClick={() => answer(m.id, { felt: true, rating: n })}>
                        {n}
                      </Toggle>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="3. Any pain or discomfort during the set?">
        <div className="mb-3 flex gap-1" role="group" aria-label="Any pain or discomfort?">
          <Toggle on={hadDiscomfort === true} onClick={() => setHadDiscomfort(true)}>
            Yes
          </Toggle>
          <Toggle
            on={hadDiscomfort === false}
            onClick={() => {
              setHadDiscomfort(false);
              setNotes([]);
            }}
          >
            No
          </Toggle>
        </div>
        {hadDiscomfort && (
          <DiscomfortMarker videoUrl={videoUrl} areas={coaching.discomfort.areas} notes={notes} onChange={setNotes} />
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            onSubmit({
              muscles,
              discomfort: notes.map((n) => ({ id: n.id, timeSec: n.timeSec, point: n.point, areaId: n.areaId, note: n.note })),
            })
          }
        >
          See my form and cues
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back to the video
        </Button>
      </div>
    </div>
  );
}

export function Toggle({ on, small, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        "rounded-lg border text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand-500",
        small ? "size-9" : "px-3 py-1.5",
        on ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-surface text-ink hover:bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
}
