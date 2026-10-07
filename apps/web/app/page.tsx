import Link from "next/link";
import { Card } from "@optimass/ui";

export default function HomePage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card title="Planner">
        <p className="mb-3 text-sm text-ink-muted">Build hypertrophy programs from rated exercises.</p>
        <Link href="/planner" className="text-sm font-medium text-brand-700">
          Open planner
        </Link>
      </Card>
      <Card title="Analyzer">
        <p className="mb-3 text-sm text-ink-muted">Film a set and get a three-tier technique report.</p>
        <Link href="/analyzer" className="text-sm font-medium text-brand-700">
          Open analyzer
        </Link>
      </Card>
    </div>
  );
}
