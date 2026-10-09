"use client";

import { Card } from "@optimass/ui";
import type { CoachingTable } from "@optimass/diagnostics";
import type { SetRecord } from "./SetSession";

/** Set-by-set view of what changed: errors, how strongly each muscle was felt, discomfort notes. */
export function SessionSummary({ sets, coaching }: { sets: SetRecord[]; coaching: CoachingTable }) {
  const muscles = coaching.feel.muscles;
  return (
    <Card title="Session done: how your sets compare">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="text-xs text-ink-muted">
            <tr>
              <th className="py-2 pr-3 font-medium"> </th>
              {sets.map((_, i) => (
                <th key={i} className="py-2 pr-3 font-medium">
                  Set {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <th className="py-2 pr-3 font-medium text-ink">Form errors</th>
              {sets.map((s, i) => (
                <td key={i} className="py-2 pr-3 text-ink">
                  {s.coaching.errors.length}
                </td>
              ))}
            </tr>
            {muscles.map((m) => (
              <tr key={m.id}>
                <th className="py-2 pr-3 font-medium text-ink">
                  {m.label}
                  <span className="block text-xs font-normal text-ink-muted">{m.role === "target" ? "want to feel" : "watch for"}</span>
                </th>
                {sets.map((s, i) => {
                  const a = s.feedback?.muscles?.[m.id];
                  return (
                    <td key={i} className="py-2 pr-3 text-ink">
                      {!a ? "–" : a.felt ? `${a.rating ?? "?"}/10` : "not felt"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th className="py-2 pr-3 font-medium text-ink">Discomfort notes</th>
              {sets.map((s, i) => (
                <td key={i} className="py-2 pr-3 text-ink">
                  {s.feedback?.discomfort?.length ?? 0}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-muted">Nothing is saved yet. This summary is lost when you leave the page.</p>
    </Card>
  );
}
