"use client";

import { Button, Card, Panel } from "@optimass/ui";
import type { CueKind } from "@optimass/diagnostics";
import type { SetRecord } from "./SetSession";

const CUE_GROUPS: { kind: CueKind; heading: string }[] = [
  { kind: "comfort", heading: "To ease the discomfort" },
  { kind: "form", heading: "For your form" },
  { kind: "feel", heading: "To feel the right muscles" },
];

const SEVERITY_DOT = { minor: "bg-severity-minor", moderate: "bg-severity-moderate", major: "bg-severity-major" } as const;

export function ReviewStep({ setNumber, record, isLast, onNext }: { setNumber: number; record: SetRecord; isLast: boolean; onNext: () => void }) {
  const { errors, causes, cues, safetyNote } = record.coaching;

  return (
    <div className="space-y-4">
      {safetyNote && (
        <p role="alert" className="rounded-card border border-severity-major bg-surface px-4 py-3 text-sm text-ink">
          {safetyNote}
        </p>
      )}

      <Card title={`Set ${setNumber}: your feedback`}>
        <div className="grid gap-3 md:grid-cols-2">
          <Panel heading="What we saw" className="border-l-4 border-tier1">
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
          </Panel>

          <Panel heading="Likely causes" className="border-l-4 border-tier2">
            {causes.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing to explain on this set.</p>
            ) : (
              <ol className="space-y-2">
                {causes.map((c) => (
                  <li key={c.id} className="text-sm text-ink">
                    <details>
                      <summary className="cursor-pointer">
                        {c.rank}. {c.label.replace(" (PLACEHOLDER)", "")}
                      </summary>
                      <div className="mt-1 space-y-1 pl-4 text-xs text-ink-muted">
                        <p>
                          <span className="font-medium text-ink">Check it:</span> {c.screeningTest.name.replace(" (PLACEHOLDER)", "")}
                        </p>
                        <p>{c.screeningTest.procedure.replace(/TODO\(Tony\)[^.]*\. ?/, "")}</p>
                      </div>
                    </details>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-xs text-ink-muted">These are possibilities to check, not a diagnosis.</p>
          </Panel>
        </div>
      </Card>

      <Card title={isLast ? "Take these into your next session" : `Try this on set ${setNumber + 1}`} className="border-l-4 border-tier3">
        {cues.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing to change. Keep doing what you did.</p>
        ) : (
          <div className="space-y-4">
            {CUE_GROUPS.map(({ kind, heading }) => {
              const group = cues.filter((c) => c.kind === kind);
              if (group.length === 0) return null;
              return (
                <section key={kind}>
                  <h3 className="mb-2 text-sm font-semibold text-ink">{heading}</h3>
                  <ul className="space-y-2">
                    {group.map((c) => (
                      <li key={c.text} className="text-sm text-ink">
                        {c.text}
                        <span className="block text-xs text-ink-muted">Because: {c.because.join("; ").replaceAll(" (PLACEHOLDER)", "")}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </Card>

      <Button onClick={onNext}>{isLast ? "Finish session" : `Film set ${setNumber + 1}`}</Button>
    </div>
  );
}
