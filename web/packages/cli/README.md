# @prompt-anonymizer/cli

Anonymize PII before it reaches an LLM — with consistent, reversible labels —
from the command line. Fully on-device (transformers.js NER + regex
recognizers); mirrors the Python `prompt-anonymizer` CLI (same commands,
flags and JSON output).

## Usage

```bash
npx @prompt-anonymizer/cli anonymize -t "山田太郎の電話は090-1234-5678"
# <人名_1>の電話は<電話番号_1>

npx @prompt-anonymizer/cli anonymize -l en --mapping-file mapping.json \
  -t "Contact John Smith at john@example.com"
npx @prompt-anonymizer/cli deanonymize --mapping-file mapping.json -t "<Name_1> ..."
```

## Commit-time / CI gate

The `scan` subcommand exits `0` when inputs are clean, `1` when PII is found
and `2` on errors. It reports `file:line:col` and the entity type only — the
matched text is never printed, so hook output and CI logs stay PII-free.
Offline, deterministic and model-free by default.

```bash
npx @prompt-anonymizer/cli scan src/prompt.txt docs/*.md
git diff --cached -U0 | npx @prompt-anonymizer/cli scan
```

With husky + lint-staged:

```json
{ "lint-staged": { "*": "prompt-anonymizer scan" } }
```

Supported languages: `ja`, `en`, `es`, `vi`, `zh`, `ko`, `fr`, `de`, `pt`,
`it` (plus `auto` detection).

## Documentation

Full docs, demos and the supported-entity table:
[github.com/akazah/prompt-anonymizer](https://github.com/akazah/prompt-anonymizer)

MIT © akazah
