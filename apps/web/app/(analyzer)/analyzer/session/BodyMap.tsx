"use client";

import type { CoachingTable } from "@optimass/diagnostics";

export type BodyRegion = NonNullable<CoachingTable["feel"]["muscles"][number]["region"]>;

// A simple back view in a 200 x 320 box. Shapes are stylised, not anatomical: they only need to be
// recognisable enough to tap. Left-side shapes are mirrored to the right with mirror().
const LEFT: Record<BodyRegion, string[]> = {
  upper_traps: ["M86 46 L100 43 L114 46 L140 60 L100 57 L60 60 Z"],
  rear_delts: ["M60 60 C46 60 40 70 40 84 L56 84 L62 66 Z"],
  rhomboids: ["M90 64 L110 64 L108 104 L92 104 Z"],
  lats: ["M64 74 L88 108 L94 150 L78 164 L68 124 Z"],
  arms: ["M40 86 L56 86 L54 148 L42 148 Z", "M42 152 L54 152 L50 214 L38 214 Z"],
};

const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${200 - Number(x)} ${y}`);

const SHAPES: Record<BodyRegion, string[]> = Object.fromEntries(
  Object.entries(LEFT).map(([region, paths]) => [region, region === "rhomboids" || region === "upper_traps" ? paths : [...paths, ...paths.map(mirror)]]),
) as Record<BodyRegion, string[]>;

export function BodyMap({
  active,
  available,
  onToggle,
}: {
  /** Regions the lifter has marked as felt. */
  active: ReadonlySet<BodyRegion>;
  /** Regions that belong to a muscle we ask about; others aren't drawn as tappable. */
  available: ReadonlySet<BodyRegion>;
  onToggle: (region: BodyRegion) => void;
}) {
  return (
    <svg viewBox="0 0 200 320" className="mx-auto h-72 w-auto touch-manipulation select-none" aria-hidden>
      {/* Silhouette */}
      <g className="fill-surface-muted stroke-border" strokeWidth={1.5}>
        <circle cx={100} cy={26} r={16} />
        <path d="M92 40 L108 40 L110 48 L90 48 Z" />
        <path d="M60 60 L140 60 L134 172 L66 172 Z" />
        <path d="M66 172 L134 172 L138 200 L62 200 Z" />
        <path d="M66 200 L98 200 L94 312 L72 312 Z" />
        <path d="M102 200 L134 200 L128 312 L106 312 Z" />
        {[...LEFT.arms, ...LEFT.arms.map(mirror), ...LEFT.rear_delts, ...LEFT.rear_delts.map(mirror)].map((d) => (
          <path key={`s-${d}`} d={d} />
        ))}
        <path d="M38 214 L50 214 L50 228 L38 228 Z" />
        <path d="M150 214 L162 214 L162 228 L150 228 Z" />
      </g>
      {(Object.keys(SHAPES) as BodyRegion[])
        .filter((r) => available.has(r))
        .map((region) => (
          <g
            key={region}
            onClick={() => onToggle(region)}
            className={
              active.has(region)
                ? "cursor-pointer fill-brand-500 stroke-brand-700"
                : "cursor-pointer fill-brand-100/60 stroke-brand-500 hover:fill-brand-100"
            }
            strokeWidth={1.5}
            strokeDasharray={active.has(region) ? undefined : "3 2"}
          >
            {SHAPES[region].map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        ))}
      <text x={100} y={318} textAnchor="middle" className="fill-ink-muted text-[9px]">
        Back view
      </text>
    </svg>
  );
}
