English | [日本語](README_ja.md)

# Prompt Anonymizer

> Anonymize PII before it reaches an LLM — with consistent, **reversible** labels. Japanese & English.

[![CI](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml/badge.svg)](https://github.com/akazah/prompt-anonymizer/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/python-3.12%E2%80%933.13-blue)](pyproject.toml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Sending prompts to an LLM often means sending names, phone numbers, emails and
addresses along with them. Prompt Anonymizer replaces that PII with consistent
labels (`<人名_1>`, `<Name_1>`, …) **before** the text leaves your machine — and
because the same value always gets the same label, the LLM's answer still makes
sense. When the reply comes back, the mapping (which never left your device)
restores the real values.

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
| **Browser (WebGPU)** | [akazah.github.io/prompt-anonymizer](https://akazah.github.io/prompt-anonymizer/) | 100% on-device: NER runs in your browser via WebGPU (WASM fallback). Your text is never sent to a server. |
| **Desktop app** | Download from [Releases](https://github.com/akazah/prompt-anonymizer/releases) (`.dmg` / `.msi` / `.AppImage` / `.deb`) | Tauri 2. Unsigned for now — your OS will warn on first launch. |
| **Chrome extension** | `prompt-anonymizer-extension-*.zip` from [Releases](https://github.com/akazah/prompt-anonymizer/releases) | Unzip → `chrome://extensions` → enable Developer mode → "Load unpacked". Select text → right-click → *Anonymize selection*. |
| **Python / CLI** | `pip install git+https://github.com/akazah/prompt-anonymizer` (not on PyPI yet) | Presidio + spaCy. See Quickstart below. |

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
| CREDIT_CARD | クレジットカード | CreditCard | pattern (Python, en) |
| CUSTOM (deny list) | 秘匿情報 | Custom | exact match |

`deny_list` forces masking of specific strings; `allow_list` exempts them.

## Accuracy

Measured span-level on a seeded synthetic golden set (200 documents per
language) — see [docs/EVAL.md](docs/EVAL.md) for the full table and
`python -m prompt_anonymizer.evals` to reproduce. Highlights (Python core,
`sm` models): ja PHONE_NUMBER / EMAIL_ADDRESS / JP_POSTAL_CODE recall 1.00,
ja PERSON F1 0.93, ja LOCATION F1 0.87.

## Limitations

- **Detection is best-effort and not guaranteed.** False negatives happen;
  always review the anonymized text before sending it anywhere
  (`--interactive`, and the mapping tables in the UIs, exist for this).
- LOCATION recall is the weakest entity, especially for partial Japanese
  addresses.
- The browser NER model is a one-time ~100–300 MB download (cached afterwards).
- Desktop and extension builds are unsigned for now.

## Roadmap

See open [issues](https://github.com/akazah/prompt-anonymizer/issues) and
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Highlights: store publication
(Chrome Web Store), code signing, smaller Japanese NER models, MCP server.

## Contributing / Security / License

- [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup (uv / pnpm), test and eval commands
- [SECURITY.md](SECURITY.md) — reporting vulnerabilities and anonymization bypasses
- Licensed under the [MIT](LICENSE) License.
