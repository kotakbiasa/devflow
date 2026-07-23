# DevFlow

**Git range → portable handoff markdown** (client / junior / reviewer).  
Shipping residue, not chat.

Cursor already won interactive explain. DevFlow writes the file your next human can open outside any single IDE.

## Install (from GitHub — not npm)

The npm package name `devflow` is **taken**. Install from this repo:

```bash
git clone https://github.com/kotakbiasa/devflow.git
cd devflow
npm install && npm run build
npm link   # optional: `devflow` on PATH
```

Or one-shot:

```bash
npx --yes github:kotakbiasa/devflow handoff --offline -o HANDOFF.md
```

## Quick start

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # optional; --offline works without it
devflow handoff --audience client --out HANDOFF.md
devflow pr --base origin/main --out PR.md
devflow explain -a junior --offline -o ONBOARD.md
```

### Audiences

| Mode | Who reads it |
|------|----------------|
| `client` | Non-IDE stakeholder / agency client |
| `junior` | Engineer inheriting the work |
| `reviewer` | Senior reviewer (default) |
| `self` / `future-self` | You, later |

## Proof (not vapor)

8 free handoff samples on public PR heads (BYOK) — browse [issue #1](https://github.com/kotakbiasa/devflow/issues/1).

- Install pack gist: https://gist.github.com/kotakbiasa/71a86342a658b045e0cdc61d73165de0
- Landing: https://kotakbiasa.github.io/devflow/
- Release: https://github.com/kotakbiasa/devflow/releases/tag/v0.1.0

## Free offer

Want a free handoff on a **public** PR? [Open a free-handoff request](https://github.com/kotakbiasa/devflow/issues/new?template=free-handoff.yml) or comment on issue #1 with the PR URL — we return portable markdown. No signup. Soft pricing only after the artifact is useful.

## Pricing (after the artifact)

| Tier | Price | Notes |
|------|-------|-------|
| Free | $0 | BYOK unlimited local |
| Founding Pro | $9/mo | Only if you want more after a free handoff |

## License

MIT · Node 18+
