import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type CardProps = HTMLAttributes<HTMLDivElement> & { title?: ReactNode };

export function Card({ title, className, children, ...props }: CardProps) {
  return (
    <div className={cn("rounded-card border border-border bg-surface p-5 shadow-sm", className)} {...props}>
      {title ? <h2 className="mb-2 text-base font-semibold text-ink">{title}</h2> : null}
      {children}
    </div>
  );
}
