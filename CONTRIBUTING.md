# Contributing

Thanks for your interest! All changes go through Pull Requests; CI (lint, type
check, tests) must pass before merge.

## Setup (Python core)

```bash
git clone https://github.com/akazah/prompt-anonymizer.git
cd prompt-anonymizer
# https://docs.astral.sh/uv/
uv sync --all-extras
uv pip install \
  "https://github.com/explosion/spacy-models/releases/download/ja_core_news_sm-3.8.0/ja_core_news_sm-3.8.0-py3-none-any.whl" \
  "https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
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
pnpm test        # vitest (core)
pnpm lint        # tsc across packages
pnpm build       # core + web + extension
pnpm --filter @prompt-anonymizer/web dev        # local dev server
pnpm --filter @prompt-anonymizer/desktop dev    # Tauri (needs Rust + system deps)
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
