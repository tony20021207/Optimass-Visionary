"use client";

import { useRef, useState } from "react";
import { Button } from "@optimass/ui";
import { ActionBar } from "./controls";
import { PoseOverlay } from "./PoseOverlay";
import { TrackingPanel } from "./TrackingPanel";
import type { PoseTracking } from "./use-pose-tracking";

/** Matches packages/kinematics capture-protocol.json (decided by Tony 2026-10-09). */
const FILMING_TIPS = [
  "45° behind you, to one side",
  "About 1.5× your height away",
  "Lens at seated shoulder height, phone level",
  "Main back camera (1x), not the selfie camera",
  "Whole body, hands and bar in frame",
];

export function FilmStep({
  setNumber,
  video,
  onVideo,
  onSample,
  onDuration,
  tracking,
  onRetryTracking,
  onNext,
  onSkipFeedback,
}: {
  setNumber: number;
  video: { url: string; name: string } | null;
  onVideo: (file: File | null) => void;
  onSample?: () => void;
  /** Video length once known; used to cut the set into reps. */
  onDuration: (durationSec: number) => void;
  /** MediaPipe tracking of this video, run on the phone. */
  tracking: PoseTracking;
  onRetryTracking: () => void;
  onNext: () => void;
  onSkipFeedback: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const busy = tracking.status === "running";

  return (
    <section className="space-y-4" aria-labelledby="film-heading">
      <h2 id="film-heading" className="text-lg font-semibold text-ink">
        Set {setNumber}: film your set
      </h2>

      <details className="rounded-card border border-border bg-surface p-3" open={setNumber === 1}>
        <summary className="cursor-pointer text-sm font-medium text-ink">How to set up the camera</summary>
        <ul className="mt-2 grid gap-1.5 text-sm text-ink-muted sm:grid-cols-2">
          {FILMING_TIPS.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </details>

      {video ? (
        <div className="relative">
          <video
            ref={videoRef}
            src={video.url}
            controls
            playsInline
            muted
            onLoadedMetadata={(e) => onDuration(e.currentTarget.duration)}
            className="block max-h-[55vh] w-full rounded-card bg-black"
            aria-label={`Set ${setNumber} video`}
          />
          {tracking.status === "done" && showSkeleton && <PoseOverlay videoRef={videoRef} sequence={tracking.sequence} />}
        </div>
      ) : null}

      {video && <TrackingPanel tracking={tracking} showSkeleton={showSkeleton} onShowSkeleton={setShowSkeleton} onRetry={onRetryTracking} />}

      <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-card border-2 border-dashed border-brand-500 bg-brand-50 px-4 py-4 text-sm font-semibold text-brand-700 focus-within:outline-2 focus-within:outline-brand-500">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M15 10l4.5-2.5v9L15 14M4 7h11v10H4z" strokeLinejoin="round" />
        </svg>
        {video ? "Record or choose a different video" : "Record or choose a video"}
        <input
          type="file"
          accept="video/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => onVideo(e.target.files?.[0] ?? null)}
        />
      </label>

      {onSample && !video && (
        <Button variant="secondary" className="w-full" onClick={onSample}>
          No video handy? Use a sample clip
        </Button>
      )}

      <ActionBar>
        <Button variant="ghost" disabled={!video || busy} onClick={onSkipFeedback}>
          Skip feedback
        </Button>
        <Button className="flex-1" disabled={!video || busy} onClick={onNext}>
          {busy ? "Reading your movement…" : "Next: how did it feel?"}
        </Button>
      </ActionBar>
    </section>
  );
}
