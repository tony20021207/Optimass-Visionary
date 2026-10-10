"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@optimass/ui";

/** Primary actions pinned to the bottom of the screen on phones, inline on wider screens. */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
      {children}
    </div>
  );
}

export function Chip({ on, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        "min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-500",
        on ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-surface text-ink hover:bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
}

/** 1-10 "how strongly" slider. */
export function RatingSlider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <span className="text-lg font-semibold tabular-nums text-brand-700">{value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-8 w-full accent-brand-600"
      />
      <div className="flex justify-between text-[11px] text-ink-muted">
        <span>1 · barely</span>
        <span>10 · very strongly</span>
      </div>
    </div>
  );
}
