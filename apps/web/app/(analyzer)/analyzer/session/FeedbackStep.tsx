"use client";

import { useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button, cn } from "@optimass/ui";
import type { CoachingTable, SetFeedback } from "@optimass/diagnostics";
import { BodyMap } from "./BodyMap";
import type { BodyRegion } from "./BodyMap";
import { DiscomfortMarker } from "./DiscomfortMarker";
import type { DiscomfortNote } from "./DiscomfortMarker";

const QUESTIONS = ["Where did you feel it?", "How strongly?", "Any pain or discomfort?"] as const;

/** Starting point of each slider; the lifter moves it. */
const DEFAULT_RATING = 5;

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
  const muscles = coaching.feel.muscles;
  const [question, setQuestion] = useState(0);
  const [felt, setFelt] = useState<ReadonlySet<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [hadDiscomfort, setHadDiscomfort] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<DiscomfortNote[]>([]);

  const toggle = (id: string) =>
    setFelt((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const feltMuscles = muscles.filter((m) => felt.has(m.id));
  const activeRegions = new Set(feltMuscles.flatMap((m) => (m.region ? [m.region] : [])));
  const regions = new Set(muscles.flatMap((m) => (m.region ? [m.region] : [])));

  const submit = () =>
    onSubmit({
      muscles: Object.fromEntries(
        muscles.map((m) => [m.id, felt.has(m.id) ? { felt: true, rating: ratings[m.id] ?? DEFAULT_RATING } : { felt: false }]),
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
          <p className="text-sm text-ink-muted">Tap every area where you felt the muscles working. Leave the rest.</p>
          <BodyMap
            active={activeRegions}
            available={regions}
            onToggle={(region: BodyRegion) => muscles.filter((m) => m.region === region).forEach((m) => toggle(m.id))}
          />
          <div className="flex flex-wrap gap-2">
            {muscles.map((m) => (
              <Chip key={m.id} on={felt.has(m.id)} onClick={() => toggle(m.id)} aria-label={m.label}>
                {m.label}
                <span className="block text-[11px] font-normal opacity-80">{m.where}</span>
              </Chip>
            ))}
          </div>
        </div>
      )}

      {question === 1 &&
        (feltMuscles.length === 0 ? (
          <p className="text-sm text-ink-muted">You didn&apos;t mark any areas, so there&apos;s nothing to rate. Go back to add some, or carry on.</p>
        ) : (
          <ul className="space-y-5">
            {feltMuscles.map((m) => {
              const value = ratings[m.id] ?? DEFAULT_RATING;
              return (
                <li key={m.id}>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor={`rate-${m.id}`} className="text-sm font-medium text-ink">
                      {m.label}
                    </label>
                    <span className="text-lg font-semibold tabular-nums text-brand-700">{value}</span>
                  </div>
                  <input
                    id={`rate-${m.id}`}
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={value}
                    aria-label={`How strongly did you feel ${m.label}?`}
                    onChange={(e) => setRatings((r) => ({ ...r, [m.id]: Number(e.target.value) }))}
                    className="mt-1 h-8 w-full accent-brand-600"
                  />
                  <div className="flex justify-between text-[11px] text-ink-muted">
                    <span>1 · barely</span>
                    <span>10 · very strongly</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ))}

      {question === 2 && (
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
          {hadDiscomfort && <DiscomfortMarker videoUrl={videoUrl} areas={coaching.discomfort.areas} notes={notes} onChange={setNotes} />}
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

/** Primary actions pinned to the bottom of the screen on phones, inline on wider screens. */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
      {children}
    </div>
  );
}

export function Chip({ on, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        "min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-500",
        on ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-surface text-ink hover:bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
}
