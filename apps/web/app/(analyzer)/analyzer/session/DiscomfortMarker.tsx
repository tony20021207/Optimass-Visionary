"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Button } from "@optimass/ui";
import { formatTime } from "@optimass/diagnostics";
import type { CoachingTable } from "@optimass/diagnostics";
import { frameToBox, boxToFrame } from "./video-geometry";

export interface DiscomfortNote {
  id: string;
  timeSec: number;
  /** 0..1 fractions of the video frame (not the player box), so pins survive resizing. */
  point?: { x: number; y: number };
  areaId?: string;
  note: string;
}

type Area = CoachingTable["discomfort"]["areas"][number];

/** Pins stay visible for this long either side of their moment. */
const PIN_WINDOW_SEC = 0.75;

export function DiscomfortMarker({
  videoUrl,
  areas,
  notes,
  onChange,
}: {
  videoUrl: string;
  areas: Area[];
  notes: DiscomfortNote[];
  onChange: (notes: DiscomfortNote[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(0);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<DiscomfortNote | null>(null);
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
  }, []);

  const startMarking = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setDraft(null);
    setPlacing(true);
  };

  const place = (e: MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const box = e.currentTarget.getBoundingClientRect();
    const point = boxToFrame(e.clientX - box.left, e.clientY - box.top, box.width, box.height, v.videoWidth, v.videoHeight);
    setDraft({ id: crypto.randomUUID(), timeSec: v.currentTime, point: point ?? undefined, note: "" });
    setPlacing(false);
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = t;
    setNow(t);
  };

  const visible = [...notes, ...(draft ? [draft] : [])].filter((n) => n.point && Math.abs(n.timeSec - now) <= PIN_WINDOW_SEC);
  const areaLabel = (id?: string) => areas.find((a) => a.id === id)?.label ?? "Area not chosen";

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        Play your set and pause where it felt uncomfortable. Press <span className="font-medium text-ink">Mark this moment</span>, tap the
        spot on your body in the video, then tell us how it felt.
      </p>

      <div className="relative">
        <video
          ref={videoRef}
          src={videoUrl}
          controls={!placing}
          playsInline
          className="max-h-[60vh] w-full rounded-lg bg-black"
          onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
          onSeeked={(e) => setNow(e.currentTarget.currentTime)}
          aria-label="Your set video"
        />
        {placing && (
          <div
            role="button"
            tabIndex={0}
            aria-label="Tap where you felt discomfort"
            className="absolute inset-0 cursor-crosshair rounded-lg ring-2 ring-severity-major"
            onClick={place}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPlacing(false);
            }}
          >
            <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white">Tap where you felt it</span>
          </div>
        )}
        {visible.map((n) => (
          <Pin key={n.id} note={n} size={size} active={n.id === draft?.id} />
        ))}
      </div>

      {!draft && (
        <Button variant="secondary" onClick={startMarking} disabled={placing}>
          {placing ? "Tap the video…" : "Mark this moment"}
        </Button>
      )}

      {draft && (
        <div className="space-y-2 rounded-card border border-border p-3">
          <p className="text-sm font-medium text-ink">At {formatTime(draft.timeSec)}</p>
          <label className="block text-sm text-ink">
            Where was it?
            <select
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
              value={draft.areaId ?? ""}
              onChange={(e) => setDraft({ ...draft, areaId: e.target.value || undefined })}
            >
              <option value="">Choose an area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-ink">
            How did it feel?
            <textarea
              className="mt-1 block w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
              rows={2}
              placeholder="e.g. a pinch at the front of my shoulder at the bottom"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </label>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                onChange([...notes, draft].sort((a, b) => a.timeSec - b.timeSec));
                setDraft(null);
              }}
            >
              Save note
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <ul className="divide-y divide-border rounded-card border border-border">
          {notes.map((n) => (
            <li key={n.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm">
              <div>
                <p className="font-medium text-ink">
                  {formatTime(n.timeSec)} · {areaLabel(n.areaId)}
                </p>
                {n.note && <p className="text-ink-muted">{n.note}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" className="px-2 py-1" onClick={() => seek(n.timeSec)}>
                  Show
                </Button>
                <Button variant="ghost" className="px-2 py-1" onClick={() => onChange(notes.filter((x) => x.id !== n.id))}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface VideoSize {
  boxW: number;
  boxH: number;
  frameW: number;
  frameH: number;
}

function Pin({ note, size, active }: { note: DiscomfortNote; size: VideoSize | null; active: boolean }) {
  if (!note.point || !size) return null;
  const pos = frameToBox(note.point, size.boxW, size.boxH, size.frameW, size.frameH);
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-severity-major ${active ? "animate-pulse" : ""}`}
      style={{ left: pos.x, top: pos.y }}
    />
  );
}
