import Link from "next/link";
import { Card, Panel } from "@optimass/ui";

// Lane L3 (M8). The form check (Tier 1) and the set session are live; Tiers 2-3 in the report are still to come.
export default function AnalyzerPage() {
  return (
    <div className="space-y-4">
      <Card title="Lat pulldown · form check">
        <p className="mb-3 text-sm text-ink-muted">Film one set and see every rep checked against your good-rep standard (Tier 1).</p>
        <Link href="/analyzer/form-check" className="text-sm font-medium text-brand-700">
          Check my form
        </Link>
      </Card>
      <Card title="Lat pulldown · 3-set session">
        <p className="mb-3 text-sm text-ink-muted">
          Film a set, tell us what you felt, and get form and feel cues for the next set. Three sets in total.
        </p>
        <Link href="/analyzer/session" className="text-sm font-medium text-brand-700">
          Start a session
        </Link>
      </Card>
      <Card title="Analyzer">
        <p className="mb-4 text-sm text-ink-muted">Capture or upload, skeleton overlay, rep timeline and the report will live here (M8).</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Panel heading="Tier 1 · Form errors">—</Panel>
          <Panel heading="Tier 2 · Root causes">—</Panel>
          <Panel heading="Tier 3 · Correctives">—</Panel>
        </div>
      </Card>
    </div>
  );
}
