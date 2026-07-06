English | [日本語](README_ja.md)

# Prompt Anonymizer

> **Use frontier LLMs without showing them your PII.**
> Reversible, on-device anonymization — don't trade intelligence for privacy.

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Today you get two options. Run a local model — private, but you give up
frontier intelligence. Or paste into ChatGPT / Claude / Gemini and police
yourself, one prompt at a time. Prompt Anonymizer sits in between:

|  | Intelligence | Privacy | What you have to trust |
|---|---|---|---|
| Local model | ✗ sacrificed | ✓ | nothing |
| Frontier model, raw | ✓ | ✗ | the vendor, and your own vigilance |
| **Frontier model + Prompt Anonymizer** | **✓** | **✓** | **code you can read + one final review** |

It replaces PII with consistent labels (`<人名_1>`, `<Name_1>`, …) **before**
the text leaves your machine. Because the same value always gets the same
label, the LLM's answer still makes sense. When the reply comes back, the
mapping — which never left your device — restores the real values.

Detection runs on-device (WebGPU / WASM in the browser, spaCy or local
transformers in Python). Don't take our word for it: open DevTools, watch
the network tab, or read the source. It's MIT-licensed and small enough
to audit in one sitting.

## Demo

Anonymize → the mapping stays local → the LLM reply keeps the labels → restore:

<img alt="Browser app demo: anonymize, mapping, restore round-trip" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_web.gif?raw=true" width="85%">

<details>
<summary>CLI demo (Japanese / English)</summary>

<img alt="CLI demo (Japanese)" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_ja.gif?raw=true" width="49%"> <img alt="CLI demo (English)" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_en.gif?raw=true" width="49%">
</details>

<details>
<summary>Chrome extension demo (side panel)</summary>

<img alt="Chrome extension demo" src="https://github.com/akazah/prompt-anonymizer/blob/main/demo/demo_extension.gif?raw=true" width="40%">
</details>

## Try it

| Target | How | Notes |
|---|---|---|
| **Browser (WebGPU)** | [akazah.github.io/prompt-anonymizer](https://akazah.github.io/prompt-anonymizer/) | 100% on-device: NER runs in your browser via WebGPU (WASM fallback). Your text is never sent to a server — verify it in the network tab. |
| **Desktop app** | Download from [Releases](https://github.com/akazah/prompt-anonymizer/releases) (`.dmg` / `.msi` / `.AppImage` / `.deb`) | Tauri 2. Unsigned for now — your OS will warn on first launch. |
| **Chrome extension** | `prompt-anonymizer-extension-*.zip` from [Releases](https://github.com/akazah/prompt-anonymizer/releases) | Unzip → `chrome://extensions` → enable Developer mode → "Load unpacked". Select text → right-click → *Anonymize selection*. |
| **Python / CLI** | `pip install git+https://github.com/akazah/prompt-anonymizer` (not on PyPI yet) | Presidio + spaCy. See Quickstart below. |
| **Node CLI (npx)** | `npx @prompt-anonymizer/cli` (not on npm yet — build from `web/packages/cli`) | Same commands and flags as the Python CLI; transformers.js NER, fully on-device. |
| **Web Component** | `@prompt-anonymizer/element` (not on npm yet) | Framework-agnostic `<prompt-anonymizer>` element: drop the full anonymize → restore panel into any site (plain HTML, Svelte, Angular, …). |
| **React / Vue** | `@prompt-anonymizer/react` / `@prompt-anonymizer/vue` (not on npm yet) | Drop-in `<AnonymizerPanel />` component plus a `useAnonymizer()` hook / composable for custom UIs. See Quickstart below. |

## Quickstart (Python)

```bash
# Not published to PyPI yet - install from GitHub (a tag, or main for latest):
pip install git+https://github.com/akazah/prompt-anonymizer@v0.2.0
python -m spacy download ja_core_news_sm   # and/or en_core_web_sm
```

```python
from prompt_anonymizer import PromptAnonymizer

pa = PromptAnonymizer(languages=["ja"])
result = pa.anonymize("山田太郎の電話は090-1234-5678", language="ja")

result.text     # '<人名_1>の電話は<電話番号_1>'
result.mapping  # {'<人名_1>': '山田太郎', '<電話番号_1>': '090-1234-5678'}

llm_output = call_your_llm(result.text)          # labels survive the round trip
pa.deanonymize(llm_output, result.mapping)       # real values restored, locally
```

CLI:

```bash
prompt-anonymizer anonymize -l ja --interactive --mapping-file mapping.json \
  -t "山田太郎の電話は090-1234-5678"
prompt-anonymizer deanonymize --mapping-file mapping.json -t "<人名_1>様 ..."
```

## Quickstart (JavaScript / TypeScript)

The Node CLI mirrors the Python CLI (same commands, flags and JSON output),
running the TypeScript core with transformers.js NER on-device:

```bash
# Not published to npm yet — build from the repo:
cd web && pnpm install && pnpm --filter "./packages/*" build
node packages/cli/dist/cli.js anonymize -t "山田太郎の電話は090-1234-5678"
# Once published: npx @prompt-anonymizer/cli anonymize -t "..."
```

To embed the ready-made anonymize → restore panel in any frontend, use the
framework-agnostic web component:

```html
<script type="module">
  import { definePromptAnonymizer } from "@prompt-anonymizer/element";
  definePromptAnonymizer();
</script>
<prompt-anonymizer language="auto"></prompt-anonymizer>
```

React (`@prompt-anonymizer/react`) and Vue 3 (`@prompt-anonymizer/vue`) ship
a typed `<AnonymizerPanel />` wrapping that element:

```tsx
import { AnonymizerPanel } from "@prompt-anonymizer/react"; // or "@prompt-anonymizer/vue"

<AnonymizerPanel language="auto" denyList={["ProjectX"]}
  onAnonymize={(result) => console.log(result.text)} />
```

For custom UIs, both packages also expose the anonymize → LLM → restore
session as a hook / composable:

```ts
import { useAnonymizer } from "@prompt-anonymizer/react"; // or "@prompt-anonymizer/vue"

const { anonymize, restore, mapping, busy, error } = useAnonymizer();
const result = await anonymize(input, { language: "ja" });
// send result.text to the LLM — the mapping never leaves the device — then:
const { text: restored, unresolved } = await restore(llmReply);
```

By default detection is regex-only (emails, phone numbers, …); pass a
`ner` (e.g. `new TransformersNerBackend()` from `@prompt-anonymizer/core`)
to also mask names and locations.

## Why not …?

**Why not just use Presidio?** Use [Microsoft Presidio](https://github.com/microsoft/presidio)
directly if you need a general-purpose PII detection / anonymization
framework. Prompt Anonymizer uses Presidio as the engine of its Python core
and adds the LLM round-trip workflow on top: consistent placeholders,
anonymized prompt out, local restore after the response — plus browser,
extension and desktop surfaces that need no Python at all.

**Why not LLM Guard?** [LLM Guard](https://github.com/protectai/llm-guard)
is a solid Python-side guardrail suite with its own Anonymize/Deanonymize.
Prompt Anonymizer differs in three ways: Japanese-first detection (Japanese
names, addresses, My Number with check-digit validation), non-developer
surfaces (paste text in a browser page — no Python setup), and a codebase
small enough to actually read.

**Why not a "100% local" Chrome extension?** Several closed-source
extensions claim local processing. Claims are not audits. This project is
MIT-licensed: open the network tab, or read the source. (Malicious "AI
privacy" extensions that exfiltrate conversations have been documented —
the category has earned the skepticism.)

## How it works

1. Detection — Presidio + spaCy NER (Python) or transformers.js NER + regex
   recognizers (browser/desktop/extension), extended with Japanese-specific
   recognizers (JP phone numbers, 〒 postal codes, My Number with check-digit
   validation).
2. Consistent labeling — spans are merged (score-first) and replaced
   offset-based from the end; identical values share one label.
3. Reversal — `deanonymize(text, mapping)` restores originals, longest label
   first. The mapping is returned to you and **never persisted** by the
   library; storing it safely is your responsibility.

## Supported entities

| Entity | ja label | en label | Engine |
|---|---|---|---|
| PERSON | 人名 | Name | NER |
| LOCATION | 住所 | Location | NER |
| EMAIL_ADDRESS | メールアドレス | Email | pattern |
| PHONE_NUMBER | 電話番号 | Phone | pattern (JP/US variants) + libphonenumber (Python) |
| JP_POSTAL_CODE | 郵便番号 | PostalCode | pattern (custom) |
| JP_MY_NUMBER | マイナンバー | MyNumber | pattern + check digit (custom) |
| CREDIT_CARD | クレジットカード | CreditCard | pattern + Luhn check (both cores, ja/en) |
| CUSTOM (deny list) | 秘匿情報 | Custom | exact match |

`deny_list` forces masking of specific strings; `allow_list` exempts them.

### Optional transformer NER backend (Python)

The default NER is spaCy. For markedly better Japanese PERSON/LOCATION
recall, install the `hf` extra and switch the backend — it runs the same
model family the browser targets use via transformers.js, fully locally:

```bash
pip install "prompt-anonymizer[hf]"
```

```python
pa = PromptAnonymizer(languages=["ja"], ner_backend="hf")  # CLI: --ner-backend hf
```

Batch processing is also available and much faster than a loop:

```python
results = pa.anonymize_batch(texts, language="ja", batch_size=16)
```

## Accuracy

Measured span-level on a seeded synthetic golden set (200 documents per
language) — see [docs/EVAL.md](docs/EVAL.md) for the full table and
`python -m prompt_anonymizer.evals` to reproduce. Highlights (Python core,
`sm` models): ja PHONE_NUMBER / EMAIL_ADDRESS / JP_POSTAL_CODE / CREDIT_CARD
recall 1.00; ja PERSON recall 0.82 with spaCy, 1.00 with `ner_backend="hf"`.

These numbers exist to catch regressions, not to promise recall on
real-world text.

## Limitations

- **Detection is best-effort and not guaranteed.** False negatives happen;
  always review the anonymized text before sending it anywhere
  (`--interactive`, and the mapping tables in the UIs, exist for this).
- Anonymization hides identifiers, not context. Quasi-identifying details
  in the surrounding text (a rare job title, a specific event) can still
  narrow down who or what you're writing about.
- LOCATION recall is the weakest entity, especially for partial Japanese
  addresses.
- The browser NER model is a one-time ~100–300 MB download (cached afterwards).
- Desktop and extension builds are unsigned for now.

## Roadmap

See open [issues](https://github.com/akazah/prompt-anonymizer/issues) and
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Highlights: npm / PyPI
publication, store publication (Chrome Web Store), code signing, smaller
Japanese NER models, multi-region structured PII (more phone / national-ID
formats via checksum validation), MCP server.

## Contributing / Security / License

- [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup (uv / pnpm), test and eval commands
- [SECURITY.md](SECURITY.md) — reporting vulnerabilities and anonymization bypasses
- [MIT](LICENSE)
