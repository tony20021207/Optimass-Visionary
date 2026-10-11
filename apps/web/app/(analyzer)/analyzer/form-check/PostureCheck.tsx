"use client";

import { useState } from "react";
import { processImage } from "@optimass/pose-capture";
import type { PoseSequence } from "@optimass/types";
import { Button, cn } from "@optimass/ui";
import type { TrackingHosting } from "../session/use-pose-tracking";
import { POSTURE_VIEWS, keyMeasurements, saveBaseline } from "./baseline";
import type { AnalyzeBaseline, Baseline, PostureViewId } from "./baseline";
import { formatLimit, formatValue, unitOf } from "./form-report";
import { BASELINE_TEXT } from "./i18n";
import type { Lang } from "./i18n";

type Shot = { status: "reading" } | { status: "done"; sequence: PoseSequence } | { status: "failed"; message: string };

/**
 * The 4-view standing posture check (capture protocol: straight-on, 1 body height away, lens at hip height).
 * Photos are read on the phone and dropped; only the measurements are kept.
 */
export function PostureCheck({
  lang,
  analyze,
  hosting,
  onSaved,
  onCancel,
  readPhoto = (file, hostingOpts) => processImage(file, { ...hostingOpts, exerciseId: "posture_check", cameraView: "sagittal" }),
}: {
  lang: Lang;
  analyze: AnalyzeBaseline;
  hosting?: TrackingHosting;
  onSaved: (b: Baseline) => void;
  onCancel: () => void;
  /** Finds the body in one photo. Swappable for tests. */
  readPhoto?: (file: File, hosting?: TrackingHosting) => Promise<PoseSequence>;
}) {
  const t = BASELINE_TEXT[lang];
  const [step, setStep] = useState<"intro" | "photos" | "results">("intro");
  const [consent, setConsent] = useState(false);
  const [heightCm, setHeightCm] = useState("");
  const [shots, setShots] = useState<Partial<Record<PostureViewId, Shot>>>({});
  const [result, setResult] = useState<{ baseline: Baseline } | { error: string } | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "not-saved" | null>(null);

  const height = Number(heightCm);
  const validHeight = height >= 100 && height <= 230 ? height : undefined;

  const take = async (view: PostureViewId, file: File) => {
    setShots((s) => ({ ...s, [view]: { status: "reading" } }));
    try {
      const sequence = await readPhoto(file, hosting);
      setShots((s) => ({ ...s, [view]: { status: "done", sequence } }));
    } catch (e) {
      setShots((s) => ({ ...s, [view]: { status: "failed", message: e instanceof Error ? e.message : String(e) } }));
    }
  };

  const allDone = POSTURE_VIEWS.every((v) => shots[v]?.status === "done");

  const measure = () => {
    try {
      const captures = POSTURE_VIEWS.map((view) => ({ view, sequence: (shots[view] as { sequence: PoseSequence }).sequence }));
      const b = analyze(captures, validHeight);
      setResult({ baseline: { version: 1, savedAt: new Date().toISOString(), ...b } });
    } catch (e) {
      setResult({ error: friendlyError(e instanceof Error ? e.message : String(e), lang) });
    }
    setStep("results");
  };

  return (
    <section className="space-y-4" aria-labelledby="posture-heading" lang={lang === "zh" ? "zh-Hans" : "en"}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="posture-heading" className="text-lg font-semibold text-ink">
          {t.title}
        </h2>
        <Button variant="ghost" className="px-2 py-1" onClick={onCancel}>
          {t.back}
        </Button>
      </div>

      {step === "intro" && (
        <div className="space-y-3">
          <p className="text-sm text-ink">{t.intro}</p>
          <p className="rounded-card bg-surface-muted p-3 text-sm text-ink-muted">{t.privacy}</p>
          <div className="space-y-1.5 rounded-card border border-border bg-surface p-3">
            <p className="text-sm font-medium text-ink">{t.setupTitle}</p>
            <ul className="space-y-1.5 text-sm text-ink-muted">
              {t.setup.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <label className="block text-sm text-ink" htmlFor="posture-height">
            {t.height}
          </label>
          <input
            id="posture-height"
            inputMode="numeric"
            className="w-32 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            placeholder="175"
          />
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            {t.consent}
          </label>
          <Button className="w-full" disabled={!consent} onClick={() => setStep("photos")}>
            {t.begin}
          </Button>
        </div>
      )}

      {step === "photos" && (
        <div className="space-y-3">
          <ul className="space-y-2">
            {POSTURE_VIEWS.map((view) => {
              const [name, how] = t.views[view]!;
              const shot = shots[view];
              return (
                <li key={view} className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{name}</p>
                    <p className={cn("text-xs", shot?.status === "failed" ? "text-severity-major" : "text-ink-muted")}>
                      {shot?.status === "reading" ? t.reading : shot?.status === "done" ? `✓ ${t.found}` : shot?.status === "failed" ? shot.message : how}
                    </p>
                  </div>
                  <label
                    className={cn(
                      "flex min-h-11 shrink-0 cursor-pointer items-center rounded-xl border px-3 text-sm font-medium focus-within:outline-2 focus-within:outline-brand-500",
                      shot?.status === "done" ? "border-border bg-surface text-ink" : "border-brand-600 bg-brand-600 text-white",
                    )}
                  >
                    {shot ? t.retake : t.takePhoto}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      aria-label={`${t.takePhoto}: ${name}`}
                      disabled={shot?.status === "reading"}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void take(view, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
          <Button className="w-full" disabled={!allDone} onClick={measure}>
            {t.seeResults}
          </Button>
        </div>
      )}

      {step === "results" && result && "error" in result && (
        <div className="space-y-3">
          <p role="alert" className="rounded-card border border-severity-major/40 bg-surface p-3 text-sm text-ink">
            {t.failed(result.error)}
          </p>
          <Button variant="secondary" onClick={() => setStep("photos")}>
            {t.retake}
          </Button>
        </div>
      )}

      {step === "results" && result && "baseline" in result && (
        <BaselineResults
          baseline={result.baseline}
          lang={lang}
          saveState={saveState}
          onSave={() => {
            setSaveState(saveBaseline(result.baseline) ? "saved" : "not-saved");
            onSaved(result.baseline);
          }}
          onRetake={() => setStep("photos")}
        />
      )}
    </section>
  );
}

const SEGMENT_NAMES: Record<string, [string, string]> = {
  upper_arm: ["upper arm", "上臂"],
  forearm: ["forearm", "前臂"],
  thigh: ["thigh", "大腿"],
  shin: ["shin", "小腿"],
  trunk: ["trunk", "躯干"],
  hip_width: ["hips", "髋部"],
  shoulder_width: ["shoulders", "肩部"],
};

/** "skeleton: right_thigh was not visible in any posture view" → "your right thigh wasn't visible in any photo". */
function friendlyError(msg: string, lang: Lang): string {
  const m = /skeleton: (left_|right_)?(\w+) was not visible/.exec(msg);
  if (!m) return msg;
  const side = m[1] === "left_" ? (lang === "zh" ? "左" : "left ") : m[1] === "right_" ? (lang === "zh" ? "右" : "right ") : "";
  const [en, zh] = SEGMENT_NAMES[m[2]!] ?? [m[2]!.replace(/_/g, " "), m[2]!];
  return lang === "zh" ? `任何一张照片中都看不到你的${side}${zh}` : `your ${side}${en} wasn't visible in any photo`;
}

export function BaselineResults({
  baseline,
  lang,
  saveState,
  onSave,
  onRetake,
}: {
  baseline: Baseline;
  lang: Lang;
  saveState?: "saved" | "not-saved" | null;
  onSave?: () => void;
  onRetake?: () => void;
}) {
  const t = BASELINE_TEXT[lang];
  const order = { fail: 0, pass: 1, info: 2 } as const;
  const posture = [...baseline.posture].filter((c) => c.status !== "info").sort((a, b) => order[a.status] - order[b.status]);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">{t.resultsTitle}</h3>
        <dl className="divide-y divide-border rounded-card border border-border bg-surface text-sm">
          {keyMeasurements(baseline.skeleton).map((m) => (
            <div key={m.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <dt className="text-ink-muted">{t.measures[m.id]}</dt>
              <dd className="text-right tabular-nums text-ink">
                {Number.isNaN(m.cm) ? "–" : `${m.cm} ${lang === "zh" ? "厘米" : "cm"}`}
                {m.diffCm !== undefined && !Number.isNaN(m.diffCm) && <span className="block text-xs text-ink-muted">{t.sideDiff(m.diffCm)}</span>}
              </dd>
            </div>
          ))}
        </dl>
        {!baseline.heightCm && <p className="text-xs text-ink-muted">{t.estimated}</p>}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">{t.postureTitle}</h3>
        <ul className="space-y-2">
          {posture.map((c) => {
            const unit = unitOf(c.feature);
            const fail = c.status === "fail";
            return (
              <li key={c.id} className={cn("rounded-card p-3 text-sm", fail ? "border border-severity-major/40 bg-surface" : "bg-surface-muted")}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-ink">{t.postureLabels[c.id] ?? c.id}</span>
                  <span className={cn("shrink-0 tabular-nums", fail ? "font-semibold text-severity-major" : "text-ink")}>
                    {formatValue(c.value, unit, lang)}
                  </span>
                </div>
                <p className="text-xs text-ink-muted">{formatLimit({ ...c, unit }, lang)}</p>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-ink-muted">{t.postureNote}</p>
      </div>

      {(onSave || onRetake) && (
        <div className="flex flex-wrap items-center gap-2">
          {onSave && !saveState && <Button onClick={onSave}>{t.save}</Button>}
          {onRetake && (
            <Button variant="secondary" onClick={onRetake}>
              {t.retake}
            </Button>
          )}
          {saveState && <p className="w-full text-sm text-ink-muted">{saveState === "saved" ? t.saved : t.notSaved}</p>}
        </div>
      )}
    </div>
  );
}
