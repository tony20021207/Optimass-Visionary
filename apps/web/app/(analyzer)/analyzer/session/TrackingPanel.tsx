"use client";

import { Button } from "@optimass/ui";
import { TRACKING_TEXT } from "./lang";
import type { Lang } from "./lang";
import type { PoseTracking } from "./use-pose-tracking";

/** Progress while MediaPipe reads the video, then how well the body was tracked. */
export function TrackingPanel({
  tracking,
  showSkeleton,
  onShowSkeleton,
  onRetry,
  failedNote = "You can still carry on; this set\u2019s form checks will use sample data.",
  lang = "en",
}: {
  tracking: PoseTracking;
  showSkeleton: boolean;
  onShowSkeleton: (on: boolean) => void;
  onRetry: () => void;
  failedNote?: string;
  lang?: Lang;
}) {
  const t = TRACKING_TEXT[lang];
  if (tracking.status === "idle") return null;

  if (tracking.status === "running") {
    const pct = Math.round(tracking.progress * 100);
    return (
      <div className="space-y-2 rounded-card border border-border bg-surface p-3" role="status">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-ink">{t.reading}</span>
          <span className="tabular-nums text-ink-muted">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-ink-muted">{t.onPhone}</p>
      </div>
    );
  }

  if (tracking.status === "failed") {
    return (
      <div className="space-y-2 rounded-card border border-severity-moderate/40 bg-surface p-3" role="alert">
        <p className="text-sm font-medium text-ink">{t.failed}</p>
        <p className="text-sm text-ink-muted">{tracking.message}</p>
        <p className="text-xs text-ink-muted">{failedNote}</p>
        <Button variant="secondary" className="px-3 py-1.5" onClick={onRetry}>
          {t.retry}
        </Button>
      </div>
    );
  }

  const { bodyFound, hardToSee } = tracking.summary;
  return (
    <div className="space-y-2 rounded-card border border-border bg-surface p-3" role="status">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-ink">
          <svg viewBox="0 0 20 20" className="size-5 text-brand-600" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path d="M5 10.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t.tracked(Math.round(bodyFound * 100))}
        </p>
        <label className="flex shrink-0 items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" className="size-4 accent-brand-600" checked={showSkeleton} onChange={(e) => onShowSkeleton(e.target.checked)} />
          {t.skeleton}
        </label>
      </div>
      {hardToSee.length > 0 && (
        <ul className="space-y-1 text-sm text-ink-muted">
          {hardToSee.map((p) => (
            <li key={p.label}>{t.hardToSee(t.part(p.label), Math.round((1 - p.seen) * 100))}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
