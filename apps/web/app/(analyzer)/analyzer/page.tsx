import { Card, Panel } from "@optimass/ui";

// Lane L3 (M8). Placeholder until the analyzer UI is built.
export default function AnalyzerPage() {
  return (
    <Card title="Analyzer">
      <p className="mb-4 text-sm text-ink-muted">Capture or upload, skeleton overlay, rep timeline and the report will live here (M8).</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel heading="Tier 1 · Form errors">—</Panel>
        <Panel heading="Tier 2 · Root causes">—</Panel>
        <Panel heading="Tier 3 · Correctives">—</Panel>
      </div>
    </Card>
  );
}
