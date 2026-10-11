"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PoseSequence } from "@optimass/types";
import { Button, cn } from "@optimass/ui";
import { ActionBar, Chip } from "../session/controls";
import { PoseOverlay } from "../session/PoseOverlay";
import { RepVideo } from "../session/RepVideo";
import { TrackingPanel } from "../session/TrackingPanel";
import { usePoseTracking } from "../session/use-pose-tracking";
import type { TrackingHosting } from "../session/use-pose-tracking";
import { formatLimit, formatValue, resultsForClaude } from "./form-report";
import type { CheckView, FormReportView, RepView } from "./form-report";

export interface Variation {
  id: string;
  label: string;
}

/** Same camera set-up as the set session (Tony, 2026-10-09). */
const FILMING_TIPS = [
  "45° behind you, to one side, about 1.5× your height away",
  "Lens at seated shoulder height, phone level, main back camera (1x)",
  "Whole body, hands and bar in frame",
];

export function FormCheck({
  variations,
  analyze,
  trackPose = true,
  hosting,
}: {
  variations: Variation[];
  /** Tier 1 on a tracked set, for one grip variation. */
  analyze: (sequence: PoseSequence, variation: string) => FormReportView;
  /** Run MediaPipe on the video. Off in tests. */
  trackPose?: boolean;
  /** Where MediaPipe's files come from, for hosts other than the web app. */
  hosting?: TrackingHosting;
}) {
  const [variation, setVariation] = useState(variations[0]!.id);
  const [video, setVideo] = useState<{ url: string; name: string; durationSec?: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const tracking = usePoseTracking(trackPose ? (video?.url ?? null) : null, "lat_pulldown", attempt, hosting);

  useEffect(() => () => void (video && URL.revokeObjectURL(video.url)), [video]);

  const result = useMemo((): { view: FormReportView } | { error: string } | null => {
    if (tracking.status !== "done") return null;
    try {
      return { view: analyze(tracking.sequence, variation) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [tracking, variation, analyze]);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">Form check · Lat pulldown</h1>
        <p className="text-sm text-ink-muted">Film one set. Your body is tracked on this phone and every rep is checked against your good-rep standard.</p>
      </header>

      <div role="group" aria-label="Grip" className="flex flex-wrap gap-2">
        {variations.map((v) => (
          <Chip key={v.id} on={v.id === variation} onClick={() => setVariation(v.id)}>
            {v.label}
          </Chip>
        ))}
      </div>

      {!video && (
        <section className="space-y-3">
          <ul className="space-y-1.5 rounded-card border border-border bg-surface p-3 text-sm text-ink-muted">
            {FILMING_TIPS.map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
          <VideoPicker label="Record or choose a video" onFile={(f) => setVideo({ url: URL.createObjectURL(f), name: f.name })} />
        </section>
      )}

      {video && tracking.status !== "done" && (
        <TrackingPanel
          tracking={tracking}
          showSkeleton={showSkeleton}
          onShowSkeleton={setShowSkeleton}
          onRetry={() => setAttempt((n) => n + 1)}
          failedNote="Try filming again with the whole body in frame and good light."
        />
      )}

      {video && tracking.status === "done" && result && "error" in result && (
        <p role="alert" className="rounded-card border border-severity-major/40 bg-surface p-3 text-sm text-ink">
          The form checks couldn&apos;t run on this video: {result.error}
        </p>
      )}

      {video && tracking.status === "done" && result && "view" in result && (
        <Results
          key={`${video.url}-${variation}`}
          view={result.view}
          sequence={tracking.sequence}
          videoUrl={video.url}
          bodyFound={tracking.summary.bodyFound}
          hardToSee={tracking.summary.hardToSee}
          showSkeleton={showSkeleton}
          onShowSkeleton={setShowSkeleton}
          onDownload={() => downloadPoseData(tracking.sequence, video.name)}
          copyText={() => resultsForClaude(result.view, variation, { name: video.name, durationSec: tracking.sequence.frames.at(-1)!.timestampMs / 1000 })}
        />
      )}

      {video && (
        <ActionBar>
          <VideoPicker compact label="Film another set" onFile={(f) => setVideo({ url: URL.createObjectURL(f), name: f.name })} />
        </ActionBar>
      )}
    </div>
  );
}

/** Saves the tracked landmarks so a problem set can be re-run offline in the Tier 1 thread. */
export function downloadPoseData(sequence: PoseSequence, videoName: string) {
  const blob = new Blob([JSON.stringify(sequence)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${videoName.replace(/\.[^.]+$/, "") || "set"}-pose.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function VideoPicker({ label, compact, onFile }: { label: string; compact?: boolean; onFile: (file: File) => void }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-center gap-2 rounded-card text-sm font-semibold focus-within:outline-2 focus-within:outline-brand-500",
        compact
          ? "min-h-11 flex-1 border border-border bg-surface px-3 py-2 text-ink"
          : "min-h-14 border-2 border-dashed border-brand-500 bg-brand-50 px-4 py-4 text-brand-700",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path d="M15 10l4.5-2.5v9L15 14M4 7h11v10H4z" strokeLinejoin="round" />
      </svg>
      {label}
      <input
        type="file"
        accept="video/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function Results({
  view,
  sequence,
  videoUrl,
  bodyFound,
  hardToSee,
  showSkeleton,
  onShowSkeleton,
  copyText,
  onDownload,
}: {
  view: FormReportView;
  sequence: PoseSequence;
  videoUrl: string;
  bodyFound: number;
  hardToSee: { label: string; seen: number }[];
  showSkeleton: boolean;
  onShowSkeleton: (on: boolean) => void;
  copyText: () => string;
  onDownload: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const rep: RepView | undefined = view.reps[selected];

  // Errors across the set, most frequent first.
  const common = useMemo(() => {
    const counts = new Map<string, { label: string; reps: number }>();
    for (const r of view.reps)
      for (const c of r.checks)
        if (c.status === "fail") counts.set(c.id, { label: c.label, reps: (counts.get(c.id)?.reps ?? 0) + 1 });
    return [...counts.values()].sort((a, b) => b.reps - a.reps);
  }, [view]);

  const copy = async () => {
    const text = copyText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard API off https (e.g. a phone on the dev server over Wi-Fi): fall back to a selected textarea.
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
  };

  if (view.reps.length === 0) {
    return (
      <div role="alert" className="space-y-2 rounded-card border border-border bg-surface p-3 text-sm text-ink">
        <p>
          No full reps were found in this video. Film from the top of the first rep to the end of the last, with the bar and hands in
          frame.
        </p>
        <Button variant="secondary" onClick={onDownload}>
          Download tracking data
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="results-heading">
      <div className="space-y-1">
        <h2 id="results-heading" className="text-lg font-semibold text-ink">
          {view.reps.length} {view.reps.length === 1 ? "rep" : "reps"} ·{" "}
          {common.length === 0 ? "no form errors" : `${common.length} form ${common.length === 1 ? "error" : "errors"}`}
        </h2>
        <p className="text-xs text-ink-muted">
          Body tracked in {Math.round(bodyFound * 100)}% of the video
          {hardToSee.length > 0 && ` · hard to see: ${hardToSee.map((p) => p.label).join(", ")}`}
          {!view.reviewed && ` · limits are placeholders (${view.paramsVersion})`}
        </p>
      </div>

      {common.length > 0 && (
        <ul className="space-y-1 rounded-card border border-border bg-surface p-3 text-sm">
          {common.map((c) => (
            <li key={c.label} className="flex justify-between gap-3">
              <span className="text-ink">{c.label}</span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {c.reps} of {view.reps.length} reps
              </span>
            </li>
          ))}
        </ul>
      )}

      <div role="tablist" aria-label="Reps" className="flex gap-2 overflow-x-auto pb-1">
        {view.reps.map((r, i) => (
          <button
            key={r.repIndex}
            type="button"
            role="tab"
            aria-selected={i === selected}
            onClick={() => setSelected(i)}
            className={cn(
              "flex min-h-11 shrink-0 flex-col items-start rounded-xl border px-3 py-1.5 text-left text-sm",
              i === selected ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-surface text-ink",
            )}
          >
            <span className="font-semibold">Rep {r.repIndex + 1}</span>
            <span className={cn("text-xs", i === selected ? "text-white/85" : r.fails ? "text-severity-major" : "text-ink-muted")}>
              {r.fails === 0 ? "Good" : `${r.fails} ${r.fails === 1 ? "error" : "errors"}`}
            </span>
          </button>
        ))}
      </div>

      {rep && (
        <div className="space-y-3">
          <RepVideo
            videoRef={videoRef}
            url={videoUrl}
            clip={{ label: `Rep ${rep.repIndex + 1}`, windows: [{ startSec: rep.startSec, endSec: rep.endSec }] }}
            pins={[]}
            placing={false}
            placingLabel=""
            onPlace={() => {}}
            onCancelPlacing={() => {}}
            overlay={showSkeleton ? <PoseOverlay videoRef={videoRef} sequence={sequence} /> : null}
          />
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input type="checkbox" className="size-4 accent-brand-600" checked={showSkeleton} onChange={(e) => onShowSkeleton(e.target.checked)} />
            Show skeleton
          </label>
          <RepChecks rep={rep} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={copy}>
          Copy results for Claude
        </Button>
        <Button variant="ghost" onClick={onDownload}>
          Download tracking data
        </Button>
        {copied && <span className="w-full text-sm text-ink-muted">Copied. Paste it in the Tier 1 thread.</span>}
      </div>
    </section>
  );
}

function RepChecks({ rep }: { rep: RepView }) {
  const fails = rep.checks.filter((c) => c.status === "fail");
  const passes = rep.checks.filter((c) => c.status === "pass");
  const info = rep.checks.filter((c) => c.status === "info");
  return (
    <div className="space-y-3">
      {fails.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-3 text-sm text-ink">Every check passed on this rep.</p>
      ) : (
        <ul className="space-y-2" aria-label={`Form errors on rep ${rep.repIndex + 1}`}>
          {fails.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
        </ul>
      )}
      <details className="rounded-card border border-border bg-surface p-3">
        <summary className="cursor-pointer text-sm font-medium text-ink">Passed ({passes.length})</summary>
        <ul className="mt-2 space-y-2">
          {passes.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
        </ul>
      </details>
      <details className="rounded-card border border-border bg-surface p-3">
        <summary className="cursor-pointer text-sm font-medium text-ink">Measured only ({info.length})</summary>
        <ul className="mt-2 space-y-1 text-sm">
          {info.map((c) => (
            <li key={c.id} className="flex justify-between gap-3">
              <span className="text-ink-muted">{c.label}</span>
              <span className="shrink-0 tabular-nums text-ink">{formatValue(c.value, c.unit)}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function CheckRow({ check: c }: { check: CheckView }) {
  const fail = c.status === "fail";
  return (
    <li className={cn("rounded-card p-3 text-sm", fail ? "border border-severity-major/40 bg-surface" : "bg-surface-muted")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-ink">{c.label}</span>
        <span className={cn("shrink-0 tabular-nums", fail ? "font-semibold text-severity-major" : "text-ink")}>{formatValue(c.value, c.unit)}</span>
      </div>
      <p className="text-xs text-ink-muted">
        Limit: {formatLimit(c)}
        {c.fault && ` · ${c.fault}`}
      </p>
      {fail && c.why && <p className="mt-1 text-xs text-ink-muted">{c.why}</p>}
    </li>
  );
}
