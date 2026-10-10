"use client";

import { useRef, useState } from "react";
import { Button } from "@optimass/ui";
import type { CoachingTable } from "@optimass/diagnostics";
import { Chip, RatingSlider } from "./controls";
import { RepVideo } from "./RepVideo";
import type { FramePoint, RepClip } from "./RepVideo";

export interface MuscleMark {
  rating: number;
  timeSec: number;
  point?: FramePoint;
}

type Muscle = CoachingTable["feel"]["muscles"][number];

/** Starting point of each slider; the lifter moves it. */
export const DEFAULT_RATING = 5;

/** Tap where a muscle was working on the rep, say which muscle, and how strongly. One mark per muscle. */
export function MuscleMarker({
  videoUrl,
  rep,
  muscles,
  marks,
  onChange,
}: {
  videoUrl: string;
  rep: RepClip | null;
  muscles: Muscle[];
  marks: Record<string, MuscleMark>;
  onChange: (marks: Record<string, MuscleMark>) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<(MuscleMark & { muscleId?: string }) | null>(null);

  const startMarking = () => {
    videoRef.current?.pause();
    setDraft(null);
    setPlacing(true);
  };

  const save = () => {
    if (!draft?.muscleId) return;
    const { muscleId, ...mark } = draft;
    onChange({ ...marks, [muscleId]: mark });
    setDraft(null);
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = t;
  };

  const pins = [
    ...Object.entries(marks).map(([id, m]) => ({ id, timeSec: m.timeSec, point: m.point, tone: "feel" as const })),
    ...(draft ? [{ id: "draft", timeSec: draft.timeSec, point: draft.point, tone: "feel" as const, active: true }] : []),
  ];
  const marked = muscles.filter((m) => marks[m.id]);

  return (
    <div className="space-y-3">
      <RepVideo
        videoRef={videoRef}
        url={videoUrl}
        rep={rep}
        pins={pins}
        placing={placing}
        placingLabel="Tap where you felt it working"
        onPlace={(point, timeSec) => {
          setDraft({ point, timeSec, rating: DEFAULT_RATING });
          setPlacing(false);
        }}
        onCancelPlacing={() => setPlacing(false)}
      />

      {!draft && (
        <Button variant="secondary" className="w-full" onClick={startMarking} disabled={placing}>
          {placing ? "Tap the video…" : marked.length === 0 ? "Mark a muscle" : "Mark another muscle"}
        </Button>
      )}

      {draft && (
        <div className="space-y-3 rounded-card border border-border p-3">
          <div>
            <p className="text-sm font-medium text-ink">Which muscle was that?</p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Which muscle was that?">
              {muscles.map((m) => (
                <Chip key={m.id} on={draft.muscleId === m.id} onClick={() => setDraft({ ...draft, muscleId: m.id })} aria-label={m.label}>
                  {m.label}
                  <span className="block text-[11px] font-normal opacity-80">{m.where}</span>
                </Chip>
              ))}
            </div>
          </div>
          {draft.muscleId && (
            <RatingSlider
              id="rate-draft"
              label={`How strongly did you feel ${muscles.find((m) => m.id === draft.muscleId)!.label}?`}
              value={draft.rating}
              onChange={(rating) => setDraft({ ...draft, rating })}
            />
          )}
          <div className="flex gap-2">
            <Button className="flex-1" disabled={!draft.muscleId} onClick={save}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {marked.length > 0 && (
        <ul className="divide-y divide-border rounded-card border border-border">
          {marked.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 p-3 text-sm">
              <p className="font-medium text-ink">
                {m.label} <span className="font-normal text-ink-muted">· {marks[m.id]!.rating}/10</span>
              </p>
              <div className="flex gap-1">
                <Button variant="ghost" className="px-2 py-1" onClick={() => seek(marks[m.id]!.timeSec)}>
                  Show
                </Button>
                <Button
                  variant="ghost"
                  className="px-2 py-1"
                  onClick={() => onChange(Object.fromEntries(Object.entries(marks).filter(([id]) => id !== m.id)))}
                >
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
