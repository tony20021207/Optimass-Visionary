import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type PanelProps = HTMLAttributes<HTMLElement> & { heading: ReactNode; actions?: ReactNode };

/** A titled section of a page, e.g. one tier of a diagnostic report. */
export function Panel({ heading, actions, className, children, ...props }: PanelProps) {
  return (
    <section className={cn("rounded-card bg-surface-muted p-4", className)} {...props}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{heading}</h3>
        {actions}
      </header>
      {children}
    </section>
  );
}
