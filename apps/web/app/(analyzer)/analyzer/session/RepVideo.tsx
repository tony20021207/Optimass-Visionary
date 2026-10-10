"use client";

import { useEffect, useState } from "react";
import type { MouseEvent, RefObject } from "react";
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
 * The set video, held to one rep when `rep` is given: it starts at the rep, loops back at its end, and
 * scrubbing outside the rep snaps back into it. While `placing`, a tap on the frame calls onPlace.
 */
export function RepVideo({
  videoRef,
  url,
  rep,
  pins,
  placing,
  placingLabel,
  onPlace,
  onCancelPlacing,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  url: string;
  rep: RepClip | null;
  pins: VideoPin[];
  placing: boolean;
  placingLabel: string;
  onPlace: (point: FramePoint | undefined, timeSec: number) => void;
  onCancelPlacing: () => void;
}) {
  const [now, setNow] = useState(rep?.startSec ?? 0);
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

  // Jump to the rep when it changes (or once the video can seek).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !rep) return;
    const toStart = () => {
      v.currentTime = rep.startSec;
    };
    if (v.readyState >= 1) toStart();
    else v.addEventListener("loadedmetadata", toStart, { once: true });
    return () => v.removeEventListener("loadedmetadata", toStart);
  }, [videoRef, rep]);

  const keepInRep = (v: HTMLVideoElement) => {
    if (rep && (v.currentTime < rep.startSec - 0.05 || v.currentTime >= rep.endSec)) v.currentTime = rep.startSec;
    setNow(v.currentTime);
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
        className="max-h-[60vh] w-full rounded-lg bg-black"
        onTimeUpdate={(e) => keepInRep(e.currentTarget)}
        onSeeked={(e) => keepInRep(e.currentTarget)}
        aria-label={rep ? `Rep ${rep.repIndex + 1} of your set` : "Your set video"}
      />
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
