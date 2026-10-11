"use client";

import { useEffect, useState } from "react";
import { DEFAULT_MIN_VISIBILITY, NoPoseFoundError, processVideo, trackingQuality } from "@optimass/pose-capture";
import type { PoseLandmarkName, PoseSequence } from "@optimass/types";

export type PoseTracking =
  | { status: "idle" }
  | { status: "running"; progress: number }
  | { status: "done"; sequence: PoseSequence; summary: TrackingSummary }
  | { status: "failed"; message: string };

/** Body parts the pulldown checks read, each as a left/right pair. The better-seen side counts. */
const PULLDOWN_PARTS: { label: string; sides: [PoseLandmarkName, PoseLandmarkName] }[] = [
  { label: "head", sides: ["left_ear", "right_ear"] },
  { label: "shoulder", sides: ["left_shoulder", "right_shoulder"] },
  { label: "elbow", sides: ["left_elbow", "right_elbow"] },
  { label: "wrist", sides: ["left_wrist", "right_wrist"] },
  { label: "hip", sides: ["left_hip", "right_hip"] },
];

/** A part seen in fewer frames than this gets a "hard to see" note. A tracking setting, not a clinical value. */
const WELL_SEEN_SHARE = 0.8;

export interface TrackingSummary {
  /** Share of sampled frames with a body found (0..1). */
  bodyFound: number;
  /** Parts seen in too few frames, with the share they were seen in. */
  hardToSee: { label: string; seen: number }[];
}

export function summarize(sequence: Pick<PoseSequence, "frames">, framesSampled: number): TrackingSummary {
  const q = trackingQuality(sequence, framesSampled, PULLDOWN_PARTS.flatMap((p) => p.sides), DEFAULT_MIN_VISIBILITY);
  const hardToSee = PULLDOWN_PARTS.map((p) => ({ label: p.label, seen: Math.max(...p.sides.map((s) => q.seen[s] ?? 0)) })).filter(
    (p) => p.seen < WELL_SEEN_SHARE,
  );
  return { bodyFound: q.framesWithPose / q.framesSampled, hardToSee };
}

/**
 * Runs MediaPipe over the set video on the phone, in a hidden copy of the video so the lifter can keep watching.
 * Starts when `url` is set; `attempt` changes to retry.
 */
export function usePoseTracking(url: string | null, exerciseId: string, attempt = 0): PoseTracking {
  const [state, setState] = useState<PoseTracking>({ status: "idle" });

  useEffect(() => {
    if (!url) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    const abort = new AbortController();
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    // Kept in the page (some phones won't decode frames of a detached video) but out of sight.
    Object.assign(video.style, { position: "fixed", left: "0", top: "0", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
    video.setAttribute("aria-hidden", "true");
    video.src = url;
    document.body.appendChild(video);

    setState({ status: "running", progress: 0 });
    processVideo(video, {
      exerciseId,
      signal: abort.signal,
      cameraView: "sagittal", // TODO: "posterolateral" once Tony adds it to CameraView on main.
      onProgress: (progress) => !cancelled && setState({ status: "running", progress }),
    })
      .then(({ sequence, framesSampled }) => {
        if (!cancelled) setState({ status: "done", sequence, summary: summarize(sequence, framesSampled) });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof NoPoseFoundError ? err.message : `Tracking stopped: ${err instanceof Error ? err.message : String(err)}`;
        setState({ status: "failed", message });
      });

    return () => {
      cancelled = true;
      abort.abort();
      video.remove();
    };
  }, [url, exerciseId, attempt]);

  return state;
}
