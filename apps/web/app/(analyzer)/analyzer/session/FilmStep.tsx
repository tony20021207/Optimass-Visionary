"use client";

import { Button, Card } from "@optimass/ui";

/** Matches packages/kinematics capture-protocol.json (decided by Tony 2026-10-09). */
const FILMING_TIPS = [
  "Put the phone 45° behind you and to one side.",
  "Distance: about 1.5 times your height away.",
  "Lens at the height of your shoulders while seated, phone level, not tilted.",
  "Use the main back camera (1x), not the selfie camera.",
  "Keep your whole body, your hands and the bar in frame for the whole set.",
];

export function FilmStep({
  setNumber,
  video,
  onVideo,
  onNext,
  onSkipFeedback,
}: {
  setNumber: number;
  video: { url: string; name: string } | null;
  onVideo: (file: File | null) => void;
  onNext: () => void;
  onSkipFeedback: () => void;
}) {
  return (
    <Card title={`Set ${setNumber}: film your set`}>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink-muted">
        {FILMING_TIPS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>

      <label className="mb-4 flex flex-col gap-2 text-sm font-medium text-ink">
        {video ? "Replace the video" : "Record or choose a video"}
        <input
          type="file"
          accept="video/*"
          capture="environment"
          className="text-sm text-ink-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface-muted file:px-3 file:py-2 file:text-ink"
          onChange={(e) => onVideo(e.target.files?.[0] ?? null)}
        />
      </label>

      {video && (
        <video src={video.url} controls playsInline className="mb-4 max-h-[60vh] w-full rounded-lg bg-black" aria-label={`Set ${setNumber} video`} />
      )}

      <div className="flex flex-wrap gap-2">
        <Button disabled={!video} onClick={onNext}>
          Next: how did it feel?
        </Button>
        <Button variant="ghost" disabled={!video} onClick={onSkipFeedback}>
          Skip feedback, show my form
        </Button>
      </div>
    </Card>
  );
}
