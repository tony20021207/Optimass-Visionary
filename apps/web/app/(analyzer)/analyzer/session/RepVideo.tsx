"use client";

import { useEffect, useState } from "react";
import type { MouseEvent, ReactNode, RefObject } from "react";
import { boxToFrame, frameToBox } from "./video-geometry";

export interface FramePoint {
  x: number;
  y: number;
}

export interface RepClip {
  repIndex: number;
  startSec: number;
  endSec: number;
}

/** What the player is held to: one or more stretches of the video, played in order on a loop. */
export interface VideoClip {
  /** Spoken name for the player, e.g. "Rep 4, first third". */
  label: string;
  windows: { startSec: number; endSec: number }[];
}

export interface VideoPin {
  id: string;
  timeSec: number;
  /** 0..1 fractions of the video frame (not the player box), so pins survive resizing. */
  point?: FramePoint;
  tone: "feel" | "pain";
  active?: boolean;
}

/** Pins stay visible for this long either side of their moment. */
const PIN_WINDOW_SEC = 0.75;

/**
 * The set video, held to `clip` when given: it plays the clip's windows in order and loops, and scrubbing
 * outside them snaps back to the start. While `placing`, a tap on the frame calls onPlace.
 */
export function RepVideo({
  videoRef,
  url,
  clip,
  pins,
  placing,
  placingLabel,
  onPlace,
  onCancelPlacing,
  overlay,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  url: string;
  clip: VideoClip | null;
  pins: VideoPin[];
  placing: boolean;
  placingLabel: string;
  onPlace: (point: FramePoint | undefined, timeSec: number) => void;
  onCancelPlacing: () => void;
  /** Drawn over the video, under the pins (e.g. the tracked skeleton). */
  overlay?: ReactNode;
}) {
  const [now, setNow] = useState(clip?.windows[0]?.startSec ?? 0);
  const [size, setSize] = useState<VideoSize | null>(null);

  // Pins are drawn in element pixels, so track the player's size and the frame's size.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const measure = () => setSize({ boxW: v.clientWidth, boxH: v.clientHeight, frameW: v.videoWidth, frameH: v.videoHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(v);
    v.addEventListener("loadedmetadata", measure);
    return () => {
      observer.disconnect();
      v.removeEventListener("loadedmetadata", measure);
    };
  }, [videoRef]);

  // Jump to the clip when it changes (or once the video can seek).
  const firstStart = clip?.windows[0]?.startSec;
  useEffect(() => {
    const v = videoRef.current;
    if (!v || firstStart === undefined) return;
    const toStart = () => {
      v.currentTime = firstStart;
    };
    if (v.readyState >= 1) toStart();
    else v.addEventListener("loadedmetadata", toStart, { once: true });
    return () => v.removeEventListener("loadedmetadata", toStart);
  }, [videoRef, firstStart]);

  const keepInClip = (v: HTMLVideoElement) => {
    const to = clipTime(clip?.windows ?? [], v.currentTime);
    if (to !== v.currentTime) v.currentTime = to;
    setNow(to);
  };

  const place = (e: MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const box = e.currentTarget.getBoundingClientRect();
    const point = boxToFrame(e.clientX - box.left, e.clientY - box.top, box.width, box.height, v.videoWidth, v.videoHeight);
    onPlace(point ?? undefined, v.currentTime);
  };

  const visible = pins.filter((p) => p.point && (p.active || Math.abs(p.timeSec - now) <= PIN_WINDOW_SEC));

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={url}
        controls={!placing}
        playsInline
        muted
        className="block max-h-[45vh] w-full rounded-lg bg-black"
        onTimeUpdate={(e) => keepInClip(e.currentTarget)}
        onSeeked={(e) => keepInClip(e.currentTarget)}
        aria-label={clip?.label ?? "Your set video"}
      />
      {overlay}
      {placing && (
        <div
          role="button"
          tabIndex={0}
          aria-label={placingLabel}
          className="absolute inset-0 cursor-crosshair rounded-lg ring-2 ring-brand-500"
          onClick={place}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancelPlacing();
          }}
        >
          <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white">{placingLabel}</span>
        </div>
      )}
      {visible.map((p) => (
        <Pin key={p.id} pin={p} size={size} />
      ))}
    </div>
  );
}

/** Timeupdates arrive every ~250 ms, so a window counts as just finished if it ended this recently. */
const JUST_ENDED_SEC = 0.35;

/**
 * Where the player should be for time `t`: unchanged inside a window; the next window's start just after one
 * ends (looping to the first); the first window's start anywhere else.
 */
export function clipTime(windows: readonly { startSec: number; endSec: number }[], t: number): number {
  if (windows.length === 0) return t;
  if (windows.some((w) => t >= w.startSec - 0.05 && t < w.endSec)) return t; // seeks can land a hair early
  const ended = windows.findIndex((w) => t >= w.endSec && t - w.endSec < JUST_ENDED_SEC);
  return windows[ended === -1 ? 0 : (ended + 1) % windows.length]!.startSec;
}

interface VideoSize {
  boxW: number;
  boxH: number;
  frameW: number;
  frameH: number;
}

function Pin({ pin, size }: { pin: VideoPin; size: VideoSize | null }) {
  if (!pin.point || !size) return null;
  const pos = frameToBox(pin.point, size.boxW, size.boxH, size.frameW, size.frameH);
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${
        pin.tone === "pain" ? "bg-severity-major" : "bg-brand-500"
      } ${pin.active ? "animate-pulse" : ""}`}
      style={{ left: pos.x, top: pos.y }}
    />
  );
}
