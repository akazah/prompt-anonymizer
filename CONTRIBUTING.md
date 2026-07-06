# Contributing

Thanks for your interest! All changes go through Pull Requests; CI (lint, type
check, tests) must pass before merge.

## Setup (Python core)

```bash
git clone https://github.com/akazah/prompt-anonymizer.git
cd prompt-anonymizer
# https://docs.astral.sh/uv/
uv sync --all-extras --group models   # `models` = spaCy sm wheels (locked); add --group models-lg for the lg models
```

Checks:

```bash
uv run ruff check . && uv run ruff format --check src tests demo
uv run mypy src
uv run pytest -m "not slow"          # unit + integration
uv run pytest -m slow                # accuracy regression (golden set)
uv run python -m prompt_anonymizer.evals   # regenerate docs/EVAL.md + tests/golden/
```

## Setup (web workspace: browser app / extension / desktop)

```bash
cd web
pnpm install
pnpm test        # vitest (core + cli + element + react + vue)
pnpm lint        # tsc across packages
pnpm build       # all packages + apps
pnpm --filter @prompt-anonymizer/web dev        # local dev server
pnpm --filter @prompt-anonymizer/desktop dev    # Tauri (needs Rust + system deps)
node packages/cli/dist/cli.js anonymize -t "…" # Node CLI (after build)
```

End-to-end tests (Playwright, in `web/e2e/`; run `pnpm build` first — they
serve the built `dist/`):

```bash
pnpm --filter @prompt-anonymizer/e2e exec playwright install chromium   # once
pnpm e2e         # web app + Chrome extension, regex-only: offline & fast (PR CI)
pnpm e2e:ner     # full NER pipeline; downloads the models on first run and
                 # caches them in web/e2e/.cache (weekly CI)
```

The TypeScript core must stay in behavioural parity with the Python core
(label format, mapping semantics, merge rules). The shared golden set in
`tests/golden/` is the contract — regenerate it with the evals module when
you change generation logic, and keep `web/packages/core` passing.

## Versioning

SemVer. Breaking API changes bump the minor version while we are pre-1.0.
Update `CHANGELOG.md` (Keep a Changelog format) in the same PR.

## Demo assets

GIFs are generated from scripts — never hand-recorded. See `demo/README.md`.
