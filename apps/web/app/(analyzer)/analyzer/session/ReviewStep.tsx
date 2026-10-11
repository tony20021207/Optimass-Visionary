"use client";

import type { ReactNode } from "react";
import { Button } from "@optimass/ui";
import type { Cue, CueKind } from "@optimass/diagnostics";
import { ActionBar } from "./controls";
import type { SetRecord } from "./SetSession";

/** How many cues to lead with. The rest sit under "All cues". */
const FOCUS_CUES = 2;

const KIND_LABEL: Record<CueKind, string> = { comfort: "Comfort", form: "Form", feel: "Feel" };
const KIND_STYLE: Record<CueKind, string> = {
  comfort: "bg-severity-major/15 text-ink",
  form: "bg-tier1/15 text-ink",
  feel: "bg-tier3/15 text-ink",
};
const SEVERITY_DOT = { minor: "bg-severity-minor", moderate: "bg-severity-moderate", major: "bg-severity-major" } as const;

const clean = (s: string) => s.replaceAll(" (PLACEHOLDER)", "");

export function ReviewStep({ setNumber, record, isLast, onNext }: { setNumber: number; record: SetRecord; isLast: boolean; onNext: () => void }) {
  const { errors, causes, cues, safetyNote } = record.coaching;
  const focus = cues.slice(0, FOCUS_CUES);
  const rest = cues.slice(FOCUS_CUES);

  return (
    <section className="space-y-4" aria-labelledby="review-heading">
      <h2 id="review-heading" className="text-lg font-semibold text-ink">
        Set {setNumber}: your feedback
      </h2>

      {safetyNote && (
        <p role="alert" className="rounded-card border border-severity-major bg-surface px-4 py-3 text-sm text-ink">
          {safetyNote}
        </p>
      )}

      <div className="rounded-card border border-brand-500 bg-brand-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          {isLast ? "For your next session" : `On set ${setNumber + 1}, focus on`}
        </p>
        {focus.length === 0 ? (
          <p className="mt-2 text-base font-medium text-ink">Nothing to change. Repeat what you just did.</p>
        ) : (
          <ol className="mt-2 space-y-3">
            {focus.map((c, i) => (
              <li key={c.text} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{i + 1}</span>
                <CueText cue={c} large />
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="divide-y divide-border rounded-card border border-border bg-surface">
        {rest.length > 0 && (
          <Fold title={`More cues (${rest.length})`}>
            <ul className="space-y-3">
              {rest.map((c) => (
                <li key={c.text}>
                  <CueText cue={c} />
                </li>
              ))}
            </ul>
          </Fold>
        )}

        <Fold title={`What we saw (${errors.length})`}>
          {errors.length === 0 ? (
            <p className="text-sm text-ink-muted">No form errors flagged on this set.</p>
          ) : (
            <ul className="space-y-2">
              {errors.map((e) => (
                <li key={e.findingId} className="flex gap-2 text-sm text-ink">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${SEVERITY_DOT[e.severity]}`} aria-label={e.severity} />
                  <span>
                    {e.label}
                    <span className="block text-xs text-ink-muted">
                      {e.severity} · rep{e.repIndices.length > 1 ? "s" : ""} {e.repIndices.map((r) => r + 1).join(", ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Fold>

        <Fold title={`Likely causes (${causes.length})`}>
          {causes.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing to explain on this set.</p>
          ) : (
            <ol className="space-y-3">
              {causes.map((c) => (
                <li key={c.id} className="text-sm text-ink">
                  <p className="font-medium">
                    {c.rank}. {clean(c.label)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Check it with: {clean(c.screeningTest.name)}. {c.screeningTest.procedure.replace(/TODO\(Tony\)[^.]*\. ?/, "")}
                  </p>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-ink-muted">These are possibilities to check, not a diagnosis.</p>
        </Fold>

        <Fold title="Watch your set again">
          <video src={record.videoUrl} controls playsInline className="max-h-[50vh] w-full rounded-lg bg-black" aria-label={`Set ${setNumber} video`} />
        </Fold>
      </div>

      <ActionBar>
        <Button className="flex-1" onClick={onNext}>
          {isLast ? "Finish session" : `Film set ${setNumber + 1}`}
        </Button>
      </ActionBar>
    </section>
  );
}

function CueText({ cue, large }: { cue: Cue; large?: boolean }) {
  return (
    <div>
      <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_STYLE[cue.kind]}`}>{KIND_LABEL[cue.kind]}</span>
      <span className={large ? "text-base font-medium text-ink" : "text-sm text-ink"}>{cue.text}</span>
      <span className="mt-0.5 block text-xs text-ink-muted">Because: {clean(cue.because.join("; "))}</span>
    </div>
  );
}

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-ink">
        {title}
        <span className="text-ink-muted transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
