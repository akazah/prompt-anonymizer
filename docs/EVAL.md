# Accuracy (span-level, synthetic golden set)

Cases are seeded Faker documents (request / minutes / inquiry genres) with
ground-truth spans. Detection is best-effort; these numbers exist to catch
regressions, not to promise recall on real-world text.

## Python core (Presidio + spaCy)

Regenerate with `uv run python -m prompt_anonymizer.evals`.

<!-- python-eval:start -->
| Language | Entity | Precision | Recall | F1 | Support |
|---|---|---|---|---|---|
| ja | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| ja | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| ja | JP_POSTAL_CODE | 1.00 | 1.00 | 1.00 | 67 |
| ja | LOCATION | 0.92 | 0.78 | 0.85 | 200 |
| ja | PERSON | 0.98 | 0.82 | 0.89 | 267 |
| ja | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
| en | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| en | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| en | LOCATION | 0.99 | 0.94 | 0.96 | 200 |
| en | PERSON | 0.98 | 0.97 | 0.97 | 267 |
| en | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
| es | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| es | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| es | LOCATION | 0.48 | 0.71 | 0.57 | 200 |
| es | PERSON | 0.72 | 0.67 | 0.69 | 267 |
| es | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
| vi | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| vi | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| vi | LOCATION | 0.35 | 0.28 | 0.31 | 200 |
| vi | PERSON | 0.20 | 0.52 | 0.29 | 267 |
| vi | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |

Model size: `sm` / NER backend: `spacy` / cases per language: 200 (seed fixed).
<!-- python-eval:end -->

## Python core with the transformer NER backend (`ner_backend="hf"`)

Same golden set with the optional transformer NER recognizer added on top
of spaCy (`pip install "prompt-anonymizer[hf]"`). Per-language models:
`ja` → `tsmatz/xlm-roberta-ner-japanese`, `en` → `dslim/bert-base-NER`,
`es` → `Davlan/bert-base-multilingual-cased-ner-hrl`, `vi` →
`NlpHUST/ner-vietnamese-electra-base` (the TypeScript core uses the same
families for `ja`/`en` and `Xenova/bert-base-multilingual-cased-ner-hrl`
for both `es` and `vi`). Regenerate with
`uv run python -m prompt_anonymizer.evals --ner-backend hf --output /tmp/eval_hf.md --golden-dir /tmp/golden_hf`
and copy the table (the default run above owns the marker block).

| Language | Entity | Precision | Recall | F1 | Support |
|---|---|---|---|---|---|
| ja | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| ja | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| ja | JP_POSTAL_CODE | 1.00 | 1.00 | 1.00 | 67 |
| ja | LOCATION | 0.88 | 1.00 | 0.93 | 200 |
| ja | PERSON | 0.94 | 1.00 | 0.97 | 267 |
| ja | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
| en | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| en | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| en | LOCATION | 0.98 | 0.99 | 0.99 | 200 |
| en | PERSON | 0.91 | 1.00 | 0.95 | 267 |
| en | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
| es | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| es | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| es | LOCATION | 0.58 | 1.00 | 0.74 | 200 |
| es | PERSON | 0.78 | 1.00 | 0.88 | 267 |
| es | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
| vi | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| vi | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| vi | LOCATION | 0.77 | 1.00 | 0.87 | 200 |
| vi | PERSON | 0.37 | 1.00 | 0.54 | 267 |
| vi | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |

## TypeScript core (regex recognizers, structured PII only)

Same golden set, regex recognizers as used by the browser app / extension /
desktop targets. PERSON and LOCATION come from the transformers.js NER model
and are not measured here. Regenerate with
`node scripts/eval-golden.mjs` in `web/packages/core` (after `pnpm build`).

| Language | Entity | Precision | Recall | F1 | Support |
|---|---|---|---|---|---|
| ja | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| ja | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| ja | JP_POSTAL_CODE | 1.00 | 1.00 | 1.00 | 67 |
| ja | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
| en | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| en | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| en | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
| es | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| es | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| es | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
| vi | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| vi | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| vi | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
