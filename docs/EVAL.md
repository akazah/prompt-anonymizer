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

Model size: `sm` / NER backend: `spacy` / cases per language: 200 (seed fixed).
<!-- python-eval:end -->

## Python core with the transformer NER backend (`ner_backend="hf"`)

Same golden set with the optional transformer NER recognizer added on top
of spaCy (`pip install "prompt-anonymizer[hf]"`). The models are the same
family the TypeScript core runs via transformers.js
(`tsmatz/xlm-roberta-ner-japanese`, `dslim/bert-base-NER`). Regenerate with
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

## TypeScript core (regex recognizers, structured PII only)

Same golden set, regex recognizers as used by the browser app / extension /
desktop targets. PERSON and LOCATION come from the transformers.js NER model
and are not measured here. Regenerate with
`node scripts/eval-golden.mjs` in `web/packages/core` (after `pnpm build`).

| Language | Entity | Precision | Recall | F1 | Support |
|---|---|---|---|---|---|
| ja | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| ja | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| ja | JP_MY_NUMBER | 1.00 | 1.00 | 1.00 | 66 |
| ja | JP_POSTAL_CODE | 1.00 | 1.00 | 1.00 | 67 |
| ja | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
| en | CREDIT_CARD | 1.00 | 1.00 | 1.00 | 66 |
| en | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| en | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
