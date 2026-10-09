"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@optimass/ui";
import { coachSet } from "@optimass/diagnostics";
import type { CoachingTable, SetCoaching, SetFeedback, Tier2Rules } from "@optimass/diagnostics";
import { analyzeSetDemo } from "./demo-analysis";
import { FilmStep } from "./FilmStep";
import { FeedbackStep } from "./FeedbackStep";
import { ReviewStep } from "./ReviewStep";
import { SessionSummary } from "./SessionSummary";

export interface SetRecord {
  videoUrl: string;
  fileName: string;
  feedback?: SetFeedback;
  coaching: SetCoaching;
}

type Step = "film" | "feedback" | "review" | "done";

export function SetSession({
  exerciseLabel,
  coaching,
  tier2,
  totalSets,
}: {
  exerciseLabel: string;
  coaching: CoachingTable;
  tier2: Tier2Rules;
  totalSets: number;
}) {
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [step, setStep] = useState<Step>("film");
  const [video, setVideo] = useState<{ url: string; name: string } | null>(null);

  // Object URLs keep each video in memory; release them all when the page goes away.
  const objectUrls = useRef<string[]>([]);
  useEffect(() => () => objectUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const setNumber = sets.length + (step === "review" || step === "done" ? 0 : 1);

  const finishSet = (feedback?: SetFeedback) => {
    if (!video) return;
    const findings = analyzeSetDemo(sets.length);
    const result = coachSet({ findings, feedback: feedback ?? {}, coaching, tier2 });
    setSets((prev) => [...prev, { videoUrl: video.url, fileName: video.name, feedback, coaching: result }]);
    setVideo(null);
    setStep("review");
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink">{exerciseLabel} · set session</h1>
        <SetDots total={totalSets} done={sets.length} current={step === "done" ? null : setNumber} />
      </header>
      <p className="rounded-card border border-severity-minor bg-surface-muted px-4 py-2 text-xs text-ink-muted">
        Preview: the video isn&apos;t analysed yet. Form errors are sample data, and every cue and cause is a placeholder
        awaiting review.
      </p>

      {step === "film" && (
        <FilmStep
          setNumber={setNumber}
          video={video}
          onVideo={(file) => {
            if (video) URL.revokeObjectURL(video.url);
            if (!file) return setVideo(null);
            const url = URL.createObjectURL(file);
            objectUrls.current.push(url);
            setVideo({ url, name: file.name });
          }}
          onNext={() => setStep("feedback")}
          onSkipFeedback={() => finishSet()}
        />
      )}
      {step === "feedback" && video && (
        <FeedbackStep setNumber={setNumber} videoUrl={video.url} coaching={coaching} onBack={() => setStep("film")} onSubmit={finishSet} />
      )}
      {step === "review" && sets.length > 0 && (
        <ReviewStep
          setNumber={sets.length}
          record={sets[sets.length - 1]!}
          isLast={sets.length >= totalSets}
          onNext={() => setStep(sets.length >= totalSets ? "done" : "film")}
        />
      )}
      {step === "done" && <SessionSummary sets={sets} coaching={coaching} />}
      {step === "done" && (
        <Card>
          <Button
            variant="secondary"
            onClick={() => {
              sets.forEach((s) => URL.revokeObjectURL(s.videoUrl));
              setSets([]);
              setStep("film");
            }}
          >
            Start a new session
          </Button>
        </Card>
      )}
    </div>
  );
}

function SetDots({ total, done, current }: { total: number; done: number; current: number | null }) {
  return (
    <ol className="flex items-center gap-2 text-xs text-ink-muted" aria-label="Sets">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const state = n <= done ? "done" : n === current ? "current" : "todo";
        return (
          <li key={n} className="flex items-center gap-1" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={
                state === "done"
                  ? "size-2.5 rounded-full bg-brand-600"
                  : state === "current"
                    ? "size-2.5 rounded-full border-2 border-brand-600"
                    : "size-2.5 rounded-full bg-border"
              }
            />
            Set {n}
          </li>
        );
      })}
    </ol>
  );
}
