# Show HN draft

Post as a link submission to the repo (not the Pages site — HN prefers
source). First comment goes up immediately after submitting.

## Title

```
Show HN: A buddy check for PII before it reaches an LLM (on-device, reversible)
```

(80-char limit; alternates below.)

- `Show HN: Prompt Anonymizer – strip PII before it reaches ChatGPT, restore it after`
- `Show HN: Reversible on-device PII anonymization for LLM prompts`

## URL

`https://github.com/akazah/prompt-anonymizer`

## First comment (author)

```
Hi HN — I built this because every practical LLM use case I have (drafting
customer emails, summarizing support threads, reviewing contracts) involves
text full of names, phone numbers and addresses, and the two existing
options both felt wrong: run a weaker local model, or paste PII into a
frontier model and rely on my own vigilance, one prompt at a time.

Prompt Anonymizer is the buddy check I wanted — it replaces PII with
consistent labels (<Name_1>, <人名_1>) *before* the text leaves your machine.
Same value → same label, so the LLM's answer still makes sense; when the
reply comes back, a mapping that never left your device restores the real
values. It doesn't replace the "don't paste that" rule or the final review —
it's the second pair of eyes that catches the slip you didn't mean to make.

A few design decisions that might be interesting:

- Detection is fully on-device: transformers.js NER over WebGPU/WASM in
  the browser, spaCy or local transformers in Python. The browser demo
  works with DevTools open — you can watch the network tab and see that
  nothing is sent (after the one-time model download).
- Multilingual: ten languages (en, ja, es, vi, zh, ko, fr, de, pt, it) via
  a central language registry, each with locale-specific structured PII —
  e.g. per-region phone formats, and checksum-validated national IDs like
  Japan's My Number (so it doesn't blindly mask every 12-digit number).
- The mapping is returned to you and never persisted by the library.
- There's also a `scan` subcommand designed for pre-commit/CI: exit code
  1 if PII is found, and it prints file:line:col + entity type only —
  never the matched text, so your CI logs stay clean.
- An OpenAI-compatible local proxy, so existing apps only change
  OPENAI_BASE_URL.
- An MCP server (`npx @prompt-anonymizer/mcp`) with `anonymize` /
  `deanonymize` / `scan` tools — the mapping stays server-side unless you
  explicitly ask for it.

Honest limitations: detection is best-effort (the README says so in
bold) — false negatives happen, LOCATION recall is the weakest, and
anonymization hides identifiers, not context; a rare job title can still
identify someone. The interactive review step exists for exactly that
reason.

Browser demo (no install): https://akazah.github.io/prompt-anonymizer/
MIT licensed. Happy to answer anything.
```

## Prepared answers for predictable questions

- **"Why not just use Presidio?"** — We do, in the Python core. Presidio is
  a detection framework; this adds the LLM round-trip (consistent labels,
  local restore) plus non-Python surfaces (browser, extension, desktop).
- **"An LLM can re-identify from context."** — Yes. Anonymization hides
  identifiers, not context; that's in the README limitations. It raises the
  bar from "vendor has your customer list" to "vendor has an anonymized
  conversation".
- **"How do I know the browser build matches the source?"** — Build it
  yourself (`pnpm build`), or use the Python path. Reproducible-build CI is
  on the roadmap; meanwhile the network tab check works on any build.
- **"What about the model download?"** — One-time fetch from the HF CDN,
  cached; regex-only mode (emails/phones/cards) is fully offline and
  model-free.
