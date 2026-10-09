import Link from "next/link";
import { Card, Panel } from "@optimass/ui";

// Lane L3 (M8). The full analyzer (skeleton overlay, rep timeline) is still to come; the set session is live.
export default function AnalyzerPage() {
  return (
    <div className="space-y-4">
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
