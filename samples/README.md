# Dogfood samples (Cycle 3)

Generated against the Auto-Company monorepo with:

```bash
node bin/devflow.js handoff --offline --cwd ../.. -a reviewer -o samples/dogfood-handoff.md
node bin/devflow.js pr --offline --cwd ../.. -a reviewer -o samples/dogfood-pr.md
node bin/devflow.js handoff --offline --cwd ../.. -a client -o samples/devflow-self-handoff.md
```

Re-run with `ANTHROPIC_API_KEY` set (drop `--offline`) for full AI narratives.

These files are the **artifact proof** for kill criterion #2 (shareable handoff) — seat #9 (internal dogfood) already counts as shared.
