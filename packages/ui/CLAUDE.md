# @optimass/ui (M0)

Tailwind v4 preset (`src/preset.css`, design tokens via `@theme`) and shared React primitives: Button, Card, Panel, `cn`.

- Owner: main. Lanes use it and don't edit it; new shared primitives are a small PR on main.
- Public API: `@optimass/ui` and `@optimass/ui/preset.css`.
- May import: `react` only.
- apps/web imports the preset in `app/globals.css` and scans this package with `@source`.
