# README i18n

`README.md` and `docs/i18n/README_*.md` are **generated** from locale sources.
Do not edit the markdown outputs by hand — change the YAML under `locales/` and
re-render.

## Layout

| Path | Role |
|---|---|
| `config.yaml` | Language registry (native names, output paths) |
| `sections.yaml` | Ordered section IDs stitched into each README |
| `locales/<code>.yaml` | Per-language section bodies (the translation source) |
| `README.template.md` | Human-readable outline of the section order |
| `../../scripts/render_readme_i18n.py` | Render / check / bootstrap tool |

## Commands

```bash
# Regenerate README.md + docs/i18n/README_*.md after editing locale YAML
uv run python scripts/render_readme_i18n.py

# CI freshness gate (exit 1 when outputs drift)
uv run python scripts/render_readme_i18n.py --check

# One-time bootstrap from existing README files (rare)
uv run python scripts/render_readme_i18n.py --extract
```

After rendering, run `pnpm -C web docs:links` if you changed headings or TOC
anchors.

## Adding a language

1. Add an entry to `config.yaml` (and `src/prompt_anonymizer/languages.py` /
   `web/packages/core/src/languages.ts` per `docs/ADDING_A_LANGUAGE.md`).
2. Copy `locales/en.yaml` to `locales/<code>.yaml` and translate each section
   under `sections:`.
3. Run `uv run python scripts/render_readme_i18n.py`.
4. Ensure every key in `sections.yaml` has non-empty content (or intentionally
   omit optional sections — empty sections are skipped in the output).

The language switcher (first line of every README) is generated from
`config.yaml`; you do not maintain it by hand.

## Section order

See `sections.yaml` and `README.template.md`. Typical workflow when updating
product copy:

1. Edit the relevant block in `locales/en.yaml`.
2. Mirror the change in other locale files (or leave for translators).
3. Re-render and commit both the locale YAML and generated markdown.
