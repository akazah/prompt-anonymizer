# Demo assets

All GIFs in this directory are generated from scripts — never hand-recorded —
so they can be regenerated exactly after UI or label-format changes.

| Asset | Source | Regenerate with |
|---|---|---|
| `demo_ja.gif` / `demo_en.gif` | CLI story (anonymize → mapping → LLM reply → deanonymize) | `vhs demo/tapes/demo_ja.tape` (needs [vhs](https://github.com/charmbracelet/vhs), ttyd, ffmpeg, a CJK mono font, and the package installed in `.venv`) |
| `demo_web.gif` | Browser app round-trip (real NER inference) | `node demo/scripts/record_web.mjs` (needs `pnpm --filter @prompt-anonymizer/web build`, playwright + chromium, ffmpeg) |
| `demo_extension.gif` | Extension side panel (regex recognizers) | `node demo/scripts/record_extension.mjs` (needs the extension built) |

Budget: keep each GIF under ~2 MB. If a recording exceeds it, lower fps/scale
in the ffmpeg palettegen step or attach an mp4 to the GitHub Release instead.

`demo_openai.py` is the end-to-end LLM demo (requires the `demo` extra and
`OPENAI_API_KEY`); intermediate artifacts live in `demo/out/` (gitignored).
