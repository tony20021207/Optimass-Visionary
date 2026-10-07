# OptiMass: Module Breakdown and Agent Workflow Plan

Prepared 2026-10-05 for Tony. Stack: Next.js + Tailwind CSS, pnpm workspaces. Written from the vision alone (no repo attached, and nothing drawn from the previous Optimass repo).

---

## TL;DR

- **The setup is tier-independent (section 0):** 4 permanent lane worktrees with fixed folder ownership. Upgrading only changes how many lanes you open at once: 2 on Pro, up to 4 on a higher tier.
- **On Pro, run 2 Claude Code agents in parallel** as your steady state. Go to 3 only briefly, when all three are pure-logic packages with no UI or DB work. On Pro, every parallel agent draws from the same usage window, so a third agent mostly makes you hit the limit sooner. It doesn't make you finish sooner.
- **Phase 0 is strictly sequential:** one agent (Opus 5.5) builds the monorepo, the shared type contracts, and the DB schema. Nothing runs in parallel until that is merged.
- **Two parallel lanes after that:** a *Planner lane* (anatomy KB → exercise rating → program builder → planner UI) and a *Vision lane* (pose capture → kinematics → Tier 1 diagnostics). They share nothing except the read-only `types` package.
- **Sequential, by design:** Diagnostics Tier 2 → Tier 3, anything that changes contracts or the DB schema, and final integration.
- **Biggest token saver:** keep the biomechanics as **data you author** (YAML/JSON rule tables) and have agents build **engines that evaluate that data**. Agents then never have to "reason about kinesiology" from scratch, which is where most tokens get burned and where most of the errors creep in.

---

## 0. A setup that doesn't change when you upgrade

The workflow is built around **4 permanent lanes**, each with its own worktree, branch and folders it owns. Lanes, worktrees, ownership rules and phases never change. **The only thing your plan tier changes is how many lane terminals you have open at once.**

| Lane | Worktree / branch | Owns (only lane allowed to edit these) | Modules |
|---|---|---|---|
| **Main (you)** | `optimass/` · `main` | `packages/types`, `packages/ui`, root config, `apps/web/app/layout.tsx`, nav | M0, contracts PRs, M10 integration |
| **L1 Planner logic** | `optimass-planner-logic/` · `lane/planner-logic` | `packages/anatomy-kb`, `packages/exercise-rating`, `packages/program-builder` | M1 → M2 → M3 |
| **L2 Planner UI & accounts** | `optimass-planner-ui/` · `lane/planner-ui` | `apps/web/app/(planner)`, `apps/web/app/(account)`, `packages/db` | M7, M9 |
| **L3 Vision** | `optimass-vision/` · `lane/vision` | `packages/pose-capture`, `packages/kinematics`, `apps/web/app/(analyzer)` | M4 → M5 → M8 |
| **L4 Diagnostics** | `optimass-diagnostics/` · `lane/diagnostics` | `packages/diagnostics` | M6a → M6b → M6c (always sequential inside the lane) |

Your domain data in `content/` is edited by you on `main`, never by a lane.

**Set this up once, after Phase 0:**

```bash
for lane in planner-logic planner-ui vision diagnostics; do
  git worktree add ../optimass-$lane -b lane/$lane
  (cd ../optimass-$lane && pnpm install)
done
```

In each worktree, keep an untracked `.claude/settings.local.json` that denies edits outside that lane's folders. Claude Code then enforces the ownership table itself, so no agent can create a conflict, however many run. Example for L4 (patterns are relative to the repo root):

```json
{ "permissions": { "deny": [
  "Edit(/packages/types/**)", "Edit(/packages/db/**)",
  "Edit(/packages/anatomy-kb/**)", "Edit(/packages/exercise-rating/**)",
  "Edit(/packages/program-builder/**)", "Edit(/packages/pose-capture/**)",
  "Edit(/packages/kinematics/**)", "Edit(/apps/web/**)",
  "Edit(/pnpm-lock.yaml)", "Edit(/package.json)",
  "Edit(<path to your db config>)"
] } }
```

Every lane, in every configuration, denies the database config.

**How many lanes to open at once (the only setting that varies):**

| Plan | Open at once | How |
|---|---|---|
| Pro | **2** | Rotate lanes following the phase table in section 3 (L1+L3, then L1/L2+L4, then L2+L3…). Closed lanes keep their worktree, so you reopen them with no setup. |
| Higher tier | **3–4** | After Phase 0, all four lanes can start, because each builds against the fixtures in `packages/types` rather than waiting on another lane. |
| Any tier | **Never more than 4** | Four is the ceiling of this dependency graph. A fifth agent would have to share a lane's folders, which is exactly what causes conflicts and duplicated context. |

Two rules hold at every tier: Phase 0 and integration always run one agent on `main`, and Opus 5.5 is used for architecture and specs.

---

## 1. Module breakdown

Monorepo layout (pnpm workspaces, optionally Turborepo for task caching):

```
optimass/
├─ apps/web/                  Next.js App Router + Tailwind (UI only, thin)
│   └─ app/(planner)/  app/(analyzer)/  app/(account)/   ← route groups = lane boundaries
├─ packages/
│   ├─ types/                 M0  shared contracts (Zod schemas + TS types)
│   ├─ ui/                    M0  Tailwind preset + shared primitives
│   ├─ db/                    M0  schema + migrations (single owner)
│   ├─ anatomy-kb/            M1
│   ├─ exercise-rating/       M2
│   ├─ program-builder/       M3
│   ├─ pose-capture/          M4
│   ├─ kinematics/            M5
│   └─ diagnostics/           M6 (tier1/, tier2/, tier3/)
├─ content/                   YOUR domain data: muscles, exercises, rules (versioned)
└─ docs/specs/                one spec per module, written once, reused by every agent
```

| # | Module | What it does | Depends on | Kind |
|---|---|---|---|---|
| **M0** | **Foundation & contracts** (`types`, `ui`, `db`, app shell) | Zod schemas for every cross-module object: `Muscle`, `Joint`, `Exercise`, `ExerciseRating`, `Program`, `PoseFrame` (33 landmarks + visibility + timestamp), `RepSegment`, `KinematicFinding`, `RootCauseHypothesis`, `CorrectivePrescription`, `DiagnosticReport`. Tailwind preset. DB schema. Empty route groups. | none | Architecture (Opus 5.5) |
| **M1** | **Anatomy knowledge base** | Muscles, attachments, actions per joint and plane, length-tension notes, normative joint ROM. Pure data plus typed query functions (`musclesActingOn(joint, action)`, `romNorm(joint, motion)`). | M0 | Data + pure TS |
| **M2** | **Exercise rating engine** | Scores an exercise for a target muscle against your criteria: resistance profile vs. muscle length-tension (stretch-position loading), stability/external support, effective ROM, stimulus-to-fatigue, axial/systemic fatigue cost. Weighted criteria are config, so your "unique rating system" stays tunable without code changes. | M0, M1 | Pure TS |
| **M3** | **Program builder** | Weekly volume per muscle (MEV/MAV/MRV-style landmarks), frequency, split generation, exercise selection from M2 scores, progression/deload logic. | M0, M2 | Pure TS |
| **M4** | **Pose capture** | MediaPipe Pose Landmarker (`@mediapipe/tasks-vision`) in a Web Worker. Camera and uploaded-video input, landmark smoothing (e.g. One Euro filter), visibility gating. Emits a `PoseFrame[]` stream. No domain logic. | M0 | Browser TS |
| **M5** | **Kinematics** | Joint and segment angles, angular velocity, rep segmentation (eccentric/concentric/lockout), tempo, ROM achieved, symmetry, bar-path proxy from wrists. Pure math on `PoseFrame[]`. | M0 | Pure TS |
| **M6a** | **Diagnostics Tier 1: kinematic errors** | Evaluates per-exercise rule tables against M5 output: knee valgus, lumbar flexion at depth, heel rise, excessive forward trunk lean, elbow flare, partial ROM, asymmetry. Each rule declares the **required camera view** (sagittal/frontal). | M0, M5 | Rule engine |
| **M6b** | **Diagnostics Tier 2: anatomical root causes** | Maps Tier 1 findings to ranked `RootCauseHypothesis` items (e.g. heel rise + forward lean → limited ankle dorsiflexion vs. motor control), each with a confirming **screening test** (knee-to-wall, Thomas test, etc.). | M6a, M1 | Inference over your rule data |
| **M6c** | **Diagnostics Tier 3: corrective prescriptions** | Maps hypotheses to correctives (mobility, activation, strengthening) with dosage, pulling exercises from the same library M2 rates. | M6b, M1, M2 | Rule engine |
| **M7** | **Planner UI** | `app/(planner)`: muscle targeting, exercise picker with rating breakdown, program editor. | M3 (mockable) | Next.js/Tailwind |
| **M8** | **Analyzer UI** | `app/(analyzer)`: capture/upload, skeleton overlay on canvas, rep timeline, three-tier report panel. | M4, M5, M6 (mockable via `DiagnosticReport` fixtures) | Next.js/Tailwind |
| **M9** | **Persistence & accounts** | Auth, saved programs, saved analysis sessions, API routes / server actions. Uses `packages/db`. | M0 | Server |
| **M10** | **Integration** | Wire M8 end-to-end, and add "add correctives to my program" (M6c → M3). | all | Glue |

**Two honest caveats on the vision side**

1. MediaPipe gives you 2D image landmarks plus *estimated* 3D world landmarks from a single camera. Frontal-plane errors (valgus) need a frontal view; sagittal-plane errors (depth, trunk angle, butt wink) need a side view. Bake the required view into every Tier 1 rule and into the capture UI.
2. Video can't measure strength or passive mobility directly. Tier 2 should therefore output **ranked hypotheses plus the screening test that confirms each one**, not diagnoses. That is clinically defensible and gives Tier 3 a clean input.

---

## 2. Agent workflow: how many terminals

**Recommendation: 2 parallel agents, plus you as reviewer and merger.**

Why 2 and not more on Pro:
- All your sessions share one usage allowance. Three or four agents running together exhaust it proportionally faster, and then everything stalls at once.
- The dependency graph above has **two genuinely independent chains** (Planner and Vision). A third lane would either sit idle waiting on contracts or overlap with one of the two, which is where merge conflicts and duplicated exploration (wasted tokens) come from.
- You have to review every diff. As a solo developer, two streams of output is about what one person can review properly. Unreviewed agent output in biomechanics logic is the most expensive thing to fix later.

**When 3 is fine:** a short burst where all three tasks are pure packages with fixtures and no UI or DB (e.g. M1 data entry, M5 kinematics, M6a rule engine). Drop back to 2 afterwards.

**Model use:** Opus 5.5 for Phase 0 contracts and for writing each `docs/specs/*.md` (project rule: Opus 5.5 for architecture). Once a spec is written, implementation against it is well-scoped work; if you're running tight on usage, that is the place to use a lighter model.

### Terminal layout in VS Code

```
┌─────────────────────────┬─────────────────────────┐
│ Agent A: Planner lane   │ Agent B: Vision lane    │
│ ~/optimass-planner      │ ~/optimass-vision       │
│ (worktree)              │ (worktree)              │
├─────────────────────────┴─────────────────────────┤
│ You: ~/optimass (main) for review, merge, tests    │
└────────────────────────────────────────────────────┘
```

```bash
# after Phase 0 is merged to main
git worktree add ../optimass-planner -b lane/planner
git worktree add ../optimass-vision  -b lane/vision
(cd ../optimass-planner && pnpm install)   # pnpm's shared store makes this cheap
(cd ../optimass-vision  && pnpm install)
# open one VS Code terminal split per worktree and run `claude` in each
```

---

## 3. Task assignment: parallel vs. sequential

### Phase 0: SEQUENTIAL (1 agent, Opus 5.5)
Scaffold monorepo, `packages/types` (all contracts above), `packages/ui` Tailwind preset, `packages/db` schema, empty route groups, a root `CLAUDE.md` plus a short `CLAUDE.md` per package, and `docs/specs/M1…M10.md`. Also install the dependencies both lanes will need (`@mediapipe/tasks-vision`, `zod`, test runner) **now**, so neither lane edits `package.json` or `pnpm-lock.yaml` later.
→ Merge to `main`. Nothing else starts until this is merged.

### Phase 1: PARALLEL (2 worktrees)
| Agent A: Planner lane | Agent B: Vision lane |
|---|---|
| M1 anatomy-kb (engine; you supply `content/anatomy/*`) | M4 pose-capture |
| → M2 exercise-rating | → M5 kinematics (test with recorded `PoseFrame` fixtures, not a live camera) |

Safe because the lanes touch disjoint folders and only *read* `packages/types`.

### Phase 2: PARALLEL (2 worktrees)
| Agent A | Agent B |
|---|---|
| M3 program-builder → M7 planner UI in `app/(planner)` | M6a Tier 1 rule engine + your first rule tables (squat, RDL, bench) |

### Phase 3: PARALLEL, but with one sequential lane
| Agent A | Agent B (sequential chain, same agent) |
|---|---|
| M8 analyzer UI in `app/(analyzer)`, built against `DiagnosticReport` fixtures | **M6b Tier 2 → M6c Tier 3** |

M6b and M6c must be sequential and ideally done by **one agent in back-to-back sessions**. They share one causal model (finding → hypothesis → corrective), and splitting them across agents means both re-derive the same reasoning and invent incompatible intermediate shapes.

### Phase 4: SEQUENTIAL (1 agent)
M9 persistence/accounts (if not done earlier), then M10 integration. Integration touches every package and the app shell, so parallelism here only creates conflicts.

### Always sequential, whatever phase you're in
- **Any change to `packages/types`.** Make it as its own small PR on `main`, merge, then `git merge main` into both lanes.
- **Any change to the DB schema or migrations.** One owner at a time.
- **The database config itself:** agents never touch it (see guardrails below).
- **Shared layout, navigation, Tailwind preset.** Owned by Phase 0; later changes are a small dedicated PR.

---

## 4. Guardrails that prevent conflicts and save tokens

**Conflict hot spots and their fixes**

| Hot file | Rule |
|---|---|
| `pnpm-lock.yaml`, root `package.json` | Install deps in Phase 0. If a lane must add one, never hand-resolve the lockfile: take main's version and rerun `pnpm install`. |
| `packages/types` | Contracts-only PRs on main; lanes merge main in. |
| `apps/web/app/layout.tsx`, nav | Owned by Phase 0; lanes work inside their route group only. |
| DB schema | One owner at a time, never in two worktrees at once. |
| Database config | **Never edited by any agent.** Add a deny rule in `.claude/settings.json`, e.g. `"permissions": { "deny": ["Edit(<path to your db config>)", "Write(<path to your db config>)"] }`, and state it in root `CLAUDE.md`. |

**Token discipline**
- **One module per session.** Start each with `/clear` and a pointer to `docs/specs/<module>.md` and the package's `CLAUDE.md`, not "look around the repo".
- **Launch the agent from the package folder** (`cd packages/kinematics && claude`) so it reads that package's small `CLAUDE.md` and stays scoped.
- **Write external-API notes once.** Put the MediaPipe setup details (model file, `runningMode: "VIDEO"`, worker setup) into `packages/pose-capture/CLAUDE.md` so no later session re-researches them.
- **Use fixtures, not live dependencies.** Recorded `PoseFrame` JSON for M5/M6, `DiagnosticReport` JSON for M8. Agents iterate on unit tests, which is cheap, instead of browser loops, which are expensive.
- **Use plan mode for anything touching more than one package**, approve the plan, then let it execute.
- **Domain content is yours, engines are the agents'.** Exercise ratings inputs, Tier 1 thresholds, Tier 2 mappings and Tier 3 prescriptions live in `content/` as versioned YAML/JSON that you author and review as a DPT. That keeps clinical judgment in your hands and keeps agent sessions short and mechanical.

---

## 5. Dependency graph (quick reference)

```
                    M0 Foundation (sequential)
          ┌──────────────┴──────────────┐
   Planner lane                    Vision lane
   M1 anatomy-kb ─────────┐        M4 pose-capture
     │                    │          │
   M2 rating ──────────┐  │        M5 kinematics
     │                 │  │          │
   M3 program-builder  │  │        M6a Tier 1
     │                 │  └──────► M6b Tier 2   (sequential, one agent)
   M7 planner UI       └─────────► M6c Tier 3
                                     │
   M8 analyzer UI (fixtures) ◄───────┘
          └──────────────┬──────────────┘
                 M9 persistence → M10 integration (sequential)
```
