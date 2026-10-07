import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { NAV_ITEMS } from "./nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "OptiMass",
  description: "Kinesiology-based hypertrophy planner and lifting technique analyzer.",
};

// Owned by main (M0). Lanes work inside their route group, not here.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold text-brand-700">
              OptiMass
            </Link>
            <ul className="flex gap-4 text-sm">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-ink-muted hover:text-ink">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
