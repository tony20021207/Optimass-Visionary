# @optimass/web

Next.js App Router + Tailwind v4 app. UI only: keep logic in packages.

- Route groups are lane boundaries: `app/(planner)` and `app/(account)` → L2, `app/(analyzer)` → L3.
- `app/layout.tsx`, `app/nav.ts`, `app/globals.css`, `next.config.ts` are owned by main.
- Styling uses tokens from `@optimass/ui/preset.css` (e.g. `bg-surface`, `text-ink-muted`, `text-tier1`).
- `@optimass/db` is server-only: use it in server components, route handlers or server actions.
