# OptiMass

Kinesiology-based hypertrophy planner and lifting technique analyzer.

See [docs/plan.md](docs/plan.md) for the module plan and [CLAUDE.md](CLAUDE.md) for working rules.

```bash
pnpm install
pnpm dev        # apps/web on http://localhost:3000
pnpm test && pnpm lint && pnpm typecheck && pnpm build
```

Database: copy `.env.example` to `.env` and set `DATABASE_URL` (Postgres).
