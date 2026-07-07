# Demo assets

All GIFs in this directory are generated from scripts — never hand-recorded —
so they can be regenerated exactly after UI or label-format changes. Each
demo is recorded once per supported language, so README.md and every
`README_<lang>.md` embed the GIF matching their own language instead of a
shared English/Japanese-only pair.

| Asset | Source | Regenerate with |
|---|---|---|
| `demo_<lang>.gif` | CLI story (anonymize → mapping → LLM reply → deanonymize) | `vhs demo/tapes/demo_<lang>.tape` (needs [vhs](https://github.com/charmbracelet/vhs), ttyd, ffmpeg, a CJK mono / DejaVu Sans Mono font, and the package installed in `.venv` with the `models` dependency group synced) |
| `demo_web_<lang>.gif` | Browser app round-trip (real NER inference) | `node demo/scripts/record_web.mjs --lang=<lang>` (or `--lang=all`; needs `pnpm --filter @prompt-anonymizer/web build`, playwright + chromium, ffmpeg) |
| `demo_extension_<lang>.gif` | Extension side panel (regex recognizers) | `node demo/scripts/record_extension.mjs --lang=<lang>` (or `--lang=all`; needs the extension built — regex-only, no model downloads) |

`<lang>` is one of `en`, `ja`, `es`, `vi`, `zh`, `ko`, `fr`, `de`, `pt`, `it`.
Per-language sample text, phone numbers and label strings live in
`demo/scripts/lang-data.mjs`, which both recording scripts import — keep it in
sync with `src/prompt_anonymizer/labels/<lang>.yaml` and
`src/prompt_anonymizer/languages.py`'s phone patterns.

The browser and CLI demos need model downloads (transformers.js / spaCy) that
a sandboxed dev environment's network policy may block; the
`.github/workflows/demo-regen.yml` workflow (manual `workflow_dispatch`) runs
the full regeneration — for all languages and demo types by default — on a
normal-network GitHub Actions runner and commits the results back to the
triggering branch.

Budget: keep each GIF under ~2 MB. If a recording exceeds it, lower fps/scale
in the ffmpeg palettegen step or attach an mp4 to the GitHub Release instead.

`demo_openai.py` is the end-to-end LLM demo (requires the `demo` extra and
`OPENAI_API_KEY`); intermediate artifacts live in `demo/out/` (gitignored).
