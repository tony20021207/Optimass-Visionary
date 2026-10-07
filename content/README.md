# content/

Domain data authored and reviewed by Tony on `main`. Lanes never edit this folder; engines read it.

| Folder | Read by | What goes here |
|---|---|---|
| `anatomy/` | M1 | Muscles (attachments, actions, roles), joints, normative ROM |
| `exercises/` | M1–M3, M6c | Exercise library entries (shape: `Exercise` in `@optimass/types`) |
| `rating/` | M2 | Rating criteria, weights, scoring tables, rubric version |
| `rules/tier1/` | M6a | Per-lift kinematic error rules: metric, threshold, required camera view, severity |
| `rules/tier2/` | M6b | Finding → root-cause mappings, likelihoods, screening tests |
| `rules/tier3/` | M6c | Root-cause → corrective mappings and dosages |

Format: YAML (parsed with `yaml`, validated with Zod). Each folder's exact file schema is defined by its module when built.
Start with squat, RDL and bench for Tier 1.
