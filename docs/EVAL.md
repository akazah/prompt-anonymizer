# Accuracy (span-level, synthetic golden set)

Cases are seeded Faker documents (request / minutes / inquiry genres) with
ground-truth spans. Detection is best-effort; these numbers exist to catch
regressions, not to promise recall on real-world text.

## Python core (Presidio + spaCy)

Regenerate with `uv run python -m prompt_anonymizer.evals`.

<!-- python-eval:start -->
| Language | Entity | Precision | Recall | F1 | Support |
|---|---|---|---|---|---|
| ja | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| ja | JP_POSTAL_CODE | 1.00 | 1.00 | 1.00 | 67 |
| ja | LOCATION | 0.96 | 0.80 | 0.87 | 200 |
| ja | PERSON | 0.99 | 0.87 | 0.93 | 267 |
| ja | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
| en | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| en | LOCATION | 1.00 | 0.93 | 0.96 | 200 |
| en | PERSON | 0.98 | 0.94 | 0.96 | 267 |
| en | PHONE_NUMBER | 1.00 | 0.93 | 0.96 | 200 |

Model size: `sm` / cases per language: 200 (seed fixed).
<!-- python-eval:end -->

## TypeScript core (regex recognizers, structured PII only)

Same golden set, regex recognizers as used by the browser app / extension /
desktop targets. PERSON and LOCATION come from the transformers.js NER model
and are not measured here. Regenerate with
`node scripts/eval-golden.mjs` in `web/packages/core` (after `pnpm build`).

| Language | Entity | Precision | Recall | F1 | Support |
|---|---|---|---|---|---|
| ja | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| ja | JP_POSTAL_CODE | 1.00 | 1.00 | 1.00 | 67 |
| ja | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
| en | EMAIL_ADDRESS | 1.00 | 1.00 | 1.00 | 200 |
| en | PHONE_NUMBER | 1.00 | 1.00 | 1.00 | 200 |
