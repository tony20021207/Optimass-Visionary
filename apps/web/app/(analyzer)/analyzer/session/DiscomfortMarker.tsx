"use client";

import { useRef, useState } from "react";
import { Button } from "@optimass/ui";
import { formatTime } from "@optimass/diagnostics";
import type { CoachingTable } from "@optimass/diagnostics";
import { RepVideo } from "./RepVideo";
import type { FramePoint, VideoClip } from "./RepVideo";

export interface DiscomfortNote {
  id: string;
  timeSec: number;
  point?: FramePoint;
  areaId?: string;
  note: string;
}

type Area = CoachingTable["discomfort"]["areas"][number];

/** Pause where it hurt, tap the spot, pick an area and say how it felt. */
export function DiscomfortMarker({
  videoUrl,
  clip,
  areas,
  notes,
  onChange,
}: {
  videoUrl: string;
  clip: VideoClip | null;
  areas: Area[];
  notes: DiscomfortNote[];
  onChange: (notes: DiscomfortNote[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<DiscomfortNote | null>(null);

  const startMarking = () => {
    videoRef.current?.pause();
    setDraft(null);
    setPlacing(true);
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = t;
  };

  const pins = [
    ...notes.map((n) => ({ id: n.id, timeSec: n.timeSec, point: n.point, tone: "pain" as const })),
    ...(draft ? [{ id: draft.id, timeSec: draft.timeSec, point: draft.point, tone: "pain" as const, active: true }] : []),
  ];
  const areaLabel = (id?: string) => areas.find((a) => a.id === id)?.label ?? "Area not chosen";

  return (
    <div className="space-y-3">
      <RepVideo
        videoRef={videoRef}
        url={videoUrl}
        clip={clip}
        pins={pins}
        placing={placing}
        placingLabel="Tap where you felt discomfort"
        onPlace={(point, timeSec) => {
          setDraft({ id: crypto.randomUUID(), timeSec, point, note: "" });
          setPlacing(false);
        }}
        onCancelPlacing={() => setPlacing(false)}
      />

      {!draft && (
        <Button variant="secondary" className="w-full" onClick={startMarking} disabled={placing}>
          {placing ? "Tap the video…" : notes.length === 0 ? "Mark where it hurt" : "Mark another spot"}
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
              className="flex-1"
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
