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
import { loadBaseline } from "./baseline";
import type { AnalyzeBaseline, Baseline, SkeletonLike } from "./baseline";
import { BASELINE_TEXT, CHECK_LABELS_ZH, TEXT } from "./i18n";
import { PostureCheck } from "./PostureCheck";
import type { Lang } from "./i18n";
import type { CheckView, FormReportView, RepView } from "./form-report";

export interface Variation {
  id: string;
  label: string;
}

const LANG_KEY = "optimass.lang";

/** The language picked last time on this device, else the phone's own language. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    // Storage can be blocked; fall through.
  }
  return typeof navigator !== "undefined" && navigator.language?.startsWith("zh") ? "zh" : "en";
}

export function FormCheck({
  variations,
  analyze,
  analyzeBaseline,
  trackPose = true,
  hosting,
}: {
  variations: Variation[];
  /** Tier 1 on a tracked set, for one grip variation. */
  analyze: (sequence: PoseSequence, variation: string, skeleton?: SkeletonLike) => FormReportView;
  /** Posture check → baseline measurements. */
  analyzeBaseline: AnalyzeBaseline;
  /** Run MediaPipe on the video. Off in tests. */
  trackPose?: boolean;
  /** Where MediaPipe's files come from, for hosts other than the web app. */
  hosting?: TrackingHosting;
}) {
  const [variation, setVariation] = useState(variations[0]!.id);
  const [lang, setLangState] = useState<Lang>("en");
  // Read after mount: the server render can't know the phone's language or saved choice.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLangState(initialLang()), []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // Not remembered; fine.
    }
  };
  const t = TEXT[lang];
  const [mode, setMode] = useState<"check" | "posture">("check");
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  // Saved on this phone by an earlier posture check; read after mount like the language.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setBaseline(loadBaseline()), []);
  const [video, setVideo] = useState<{ url: string; name: string; durationSec?: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const tracking = usePoseTracking(trackPose ? (video?.url ?? null) : null, "lat_pulldown", attempt, hosting);

  useEffect(() => () => void (video && URL.revokeObjectURL(video.url)), [video]);

  const result = useMemo((): { view: FormReportView } | { error: string } | null => {
    if (tracking.status !== "done") return null;
    try {
      return { view: analyze(tracking.sequence, variation, baseline?.skeleton) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [tracking, variation, analyze, baseline]);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header className="space-y-1" lang={lang === "zh" ? "zh-Hans" : "en"}>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink">{t.title}</h1>
          <LangSwitch lang={lang} onChange={setLang} />
        </div>
        <p className="text-sm text-ink-muted">{t.intro}</p>
      </header>

      {mode === "posture" && (
        <PostureCheck
          lang={lang}
          analyze={analyzeBaseline}
          hosting={hosting}
          onSaved={setBaseline}
          onCancel={() => setMode("check")}
        />
      )}

      {mode === "check" && <BaselineCard baseline={baseline} lang={lang} onStart={() => setMode("posture")} />}

      {mode === "check" && (
      <div role="group" aria-label={t.grip} className="flex flex-wrap gap-2">
        {variations.map((v) => (
          <Chip key={v.id} on={v.id === variation} onClick={() => setVariation(v.id)}>
            {t.variation(v.id, v.label)}
          </Chip>
        ))}
      </div>
      )}

      {mode === "check" && !video && (
        <section className="space-y-3">
          <p className="text-sm font-medium text-ink">{t.howToFilm}</p>
          <ul className="space-y-1.5 rounded-card border border-border bg-surface p-3 text-sm text-ink-muted">
            {t.tips.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                {tip}
              </li>
            ))}
          </ul>
          <VideoPicker label={t.pick} onFile={(f) => setVideo({ url: URL.createObjectURL(f), name: f.name })} />
        </section>
      )}

      {mode === "check" && video && tracking.status !== "done" && (
        <TrackingPanel
          tracking={tracking}
          showSkeleton={showSkeleton}
          onShowSkeleton={setShowSkeleton}
          onRetry={() => setAttempt((n) => n + 1)}
          failedNote={t.trackingFailedNote}
          lang={lang}
        />
      )}

      {mode === "check" && video && tracking.status === "done" && result && "error" in result && (
        <p role="alert" className="rounded-card border border-severity-major/40 bg-surface p-3 text-sm text-ink">
          {t.checksFailed(result.error)}
        </p>
      )}

      {mode === "check" && video && tracking.status === "done" && result && "view" in result && (
        <Results
          key={`${video.url}-${variation}`}
          view={result.view}
          sequence={tracking.sequence}
          videoUrl={video.url}
          bodyFound={tracking.summary.bodyFound}
          hardToSee={tracking.summary.hardToSee}
          showSkeleton={showSkeleton}
          onShowSkeleton={setShowSkeleton}
          lang={lang}
          onDownload={() => downloadPoseData(tracking.sequence, video.name)}
          copyText={() => resultsForClaude(result.view, variation, { name: video.name, durationSec: tracking.sequence.frames.at(-1)!.timestampMs / 1000 })}
        />
      )}

      {mode === "check" && video && (
        <ActionBar>
          <VideoPicker compact label={t.another} onFile={(f) => setVideo({ url: URL.createObjectURL(f), name: f.name })} />
        </ActionBar>
      )}
    </div>
  );
}

function BaselineCard({ baseline, lang, onStart }: { baseline: Baseline | null; lang: Lang; onStart: () => void }) {
  const t = BASELINE_TEXT[lang];
  const date = baseline ? new Date(baseline.savedAt).toLocaleDateString(lang === "zh" ? "zh-CN" : undefined) : "";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{t.cardTitle}</p>
        <p className="text-xs text-ink-muted">{baseline ? `✓ ${t.savedOn(date)} · ${t.using}` : t.notDone}</p>
      </div>
      <Button variant={baseline ? "ghost" : "primary"} className="shrink-0 px-3 py-1.5" onClick={onStart}>
        {baseline ? t.redo : t.start}
      </Button>
    </div>
  );
}

function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const opt = (l: Lang, label: string) => (
    <button
      type="button"
      aria-pressed={lang === l}
      onClick={() => onChange(l)}
      className={cn(
        "min-h-9 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-500",
        lang === l ? "bg-brand-600 text-white" : "bg-surface text-ink-muted",
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Language / 语言" className="flex shrink-0 overflow-hidden rounded-xl border border-border">
      {opt("en", "EN")}
      {opt("zh", "中文")}
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
  lang = "en",
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
  lang?: Lang;
}) {
  const t = TEXT[lang];
  const label = (c: CheckView) => (lang === "zh" ? (CHECK_LABELS_ZH[c.id] ?? c.label) : c.label);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const rep: RepView | undefined = view.reps[selected];

  // Errors across the set, most frequent first.
  const common = useMemo(() => {
    const counts = new Map<string, { label: string; reps: number }>();
    for (const r of view.reps)
      for (const c of r.checks)
        if (c.status === "fail") counts.set(c.id, { label: label(c), reps: (counts.get(c.id)?.reps ?? 0) + 1 });
    return [...counts.values()].sort((a, b) => b.reps - a.reps);
    // label only changes with lang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, lang]);

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
        <p>{t.noReps}</p>
        <Button variant="secondary" onClick={onDownload}>
          {t.download}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="results-heading">
      <div className="space-y-1">
        <h2 id="results-heading" className="text-lg font-semibold text-ink">
          {t.heading(view.reps.length, common.length)}
        </h2>
        <p className="text-xs text-ink-muted">
          {t.tracked(Math.round(bodyFound * 100))}
          {hardToSee.length > 0 && t.hardToSee(hardToSee.map((p) => t.part(p.label)).join(lang === "zh" ? "、" : ", "))}
          {!view.reviewed && t.placeholders(view.paramsVersion)}
        </p>
      </div>

      {common.length > 0 && (
        <ul className="space-y-1 rounded-card border border-border bg-surface p-3 text-sm">
          {common.map((c) => (
            <li key={c.label} className="flex justify-between gap-3">
              <span className="text-ink">{c.label}</span>
              <span className="shrink-0 tabular-nums text-ink-muted">
                {t.repsHit(c.reps, view.reps.length)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div role="tablist" aria-label={t.reps} className="flex gap-2 overflow-x-auto pb-1">
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
            <span className="font-semibold">{t.rep(r.repIndex + 1)}</span>
            <span className={cn("text-xs", i === selected ? "text-white/85" : r.fails ? "text-severity-major" : "text-ink-muted")}>
              {r.fails === 0 ? t.good : t.errors(r.fails)}
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
            {t.showSkeleton}
          </label>
          <RepChecks rep={rep} lang={lang} label={label} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={copy}>
          {t.copy}
        </Button>
        <Button variant="ghost" onClick={onDownload}>
          {t.download}
        </Button>
        {copied && <span className="w-full text-sm text-ink-muted">{t.copied}</span>}
      </div>
    </section>
  );
}

function RepChecks({ rep, lang, label }: { rep: RepView; lang: Lang; label: (c: CheckView) => string }) {
  const t = TEXT[lang];
  const fails = rep.checks.filter((c) => c.status === "fail");
  const passes = rep.checks.filter((c) => c.status === "pass");
  const info = rep.checks.filter((c) => c.status === "info");
  return (
    <div className="space-y-3">
      {fails.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-3 text-sm text-ink">{t.allPassed}</p>
      ) : (
        <ul className="space-y-2" aria-label={t.errorsOnRep(rep.repIndex + 1)}>
          {fails.map((c) => (
            <CheckRow key={c.id} check={c} lang={lang} label={label(c)} />
          ))}
        </ul>
      )}
      <details className="rounded-card border border-border bg-surface p-3">
        <summary className="cursor-pointer text-sm font-medium text-ink">{t.passed(passes.length)}</summary>
        <ul className="mt-2 space-y-2">
          {passes.map((c) => (
            <CheckRow key={c.id} check={c} lang={lang} label={label(c)} />
          ))}
        </ul>
      </details>
      <details className="rounded-card border border-border bg-surface p-3">
        <summary className="cursor-pointer text-sm font-medium text-ink">{t.measuredOnly(info.length)}</summary>
        <ul className="mt-2 space-y-1 text-sm">
          {info.map((c) => (
            <li key={c.id} className="flex justify-between gap-3">
              <span className="text-ink-muted">{label(c)}</span>
              <span className="shrink-0 tabular-nums text-ink">{formatValue(c.value, c.unit, lang)}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function CheckRow({ check: c, lang, label }: { check: CheckView; lang: Lang; label: string }) {
  const t = TEXT[lang];
  const fail = c.status === "fail";
  return (
    <li className={cn("rounded-card p-3 text-sm", fail ? "border border-severity-major/40 bg-surface" : "bg-surface-muted")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-ink">{label}</span>
        <span className={cn("shrink-0 tabular-nums", fail ? "font-semibold text-severity-major" : "text-ink")}>{formatValue(c.value, c.unit, lang)}</span>
      </div>
      <p className="text-xs text-ink-muted">
        {t.limit}
        {lang === "zh" ? "：" : ": "}
        {formatLimit(c, lang)}
        {c.fault && ` · ${c.fault}`}
      </p>
      {fail && c.why && (
        <p className="mt-1 text-xs text-ink-muted" lang="en">
          {t.whyInEnglish}
          {c.why}
        </p>
      )}
    </li>
  );
}
