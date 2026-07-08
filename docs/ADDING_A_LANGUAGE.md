# Adding a language

Both cores must gain a new language together — the golden set in
`tests/golden/` is the parity contract. The supported-language set has a
single source of truth per core, and CI consistency tests fail on every
half-added state, so the workflow is: **register the language, then let the
failing tests walk you through the rest.**

| Registry | File |
|---|---|
| Python | `src/prompt_anonymizer/languages.py` (`SUPPORTED_LANGUAGES` + a `LanguageConfig` entry in `LANGUAGES`: spaCy models, HF NER model, phone spec, detection markers) |
| TypeScript | `web/packages/core/src/languages.ts` (`SUPPORTED_LANGUAGES`, `LANGUAGE_DISPLAY_NAMES`) |

Everything that is a *list of languages* (type unions, CLI validation and
help text, `<select>` pickers, detector tags, eval loops, test
parametrization) derives from the registries — do **not** add per-file
language lists. What remains is per-language *data*, listed below.

## Step-by-step

### 1. Register the code

Add the ISO 639-1 code to both registries above: a `LanguageConfig` entry
in the Python `LANGUAGES` dict (plus the code in `SUPPORTED_LANGUAGES`) and
the code + a native-script display name in the TS registry. From here on,
`uv run pytest tests/unit/test_languages.py` and
`pnpm --filter @prompt-anonymizer/core test` enumerate what is missing.

### 2. Labels (both cores, must match byte-for-byte)

- `src/prompt_anonymizer/labels/<lang>.yaml`
- `LABELS` in `web/packages/core/src/labeling.ts`

Cover **every** entity key that `en.yaml` has (including opt-in entities
like `US_SSN` / `IBAN_CODE`) — the key sets must be identical across all
languages. `web/packages/core/test/labels-parity.test.ts` diffs the YAML
files against the TS map, so any drift fails CI. Labels are part of the
reversible-mapping contract: once released they must never change.

### 3. NER models

- Python spaCy: `spacy_sm` / `spacy_lg` on the `LanguageConfig` entry (if
  no official pipeline exists, use `xx_ent_wiki_sm` like `vi` does) + the
  model wheels in `pyproject.toml` `dependency-groups` (`models`,
  `models-lg`).
- Python HF: `hf_ner_model` on the `LanguageConfig` entry
  (`DEFAULT_HF_NER_MODELS` in `core.py` derives from it).
- TypeScript: `DEFAULT_NER_MODELS` in `web/packages/core/src/ner.ts`
  (needs an ONNX export on the Hub, e.g. a `Xenova/...` model).

Empirically probe candidate models before committing (see the model notes
in `docs/EVAL.md`). Mind the licensing policy in `CONTRIBUTING.md`.

### 4. Structured-PII recognizers (usually phone numbers)

- Python: a `PhoneSpec` (libphonenumber region + regex fallback patterns +
  context words) on the `LanguageConfig` entry - the registry-driven
  `recognizers/phone.py` registers it on both the analyzer and the
  engine-free `scan` path automatically; no new module or registration
  code is needed.
- TypeScript: language-scoped entries (`languages: ["<lang>"]`) in
  `web/packages/core/src/recognizers.ts`, mirroring the Python patterns.

Keep the patterns bounded (no nested quantifiers — ReDoS is P1) and
mirror them between the cores. Add regex unit tests in both cores,
including a negative test that the patterns do NOT fire for other
languages.

### 5. Language detection

- Python: add an ordered marker rule to `DETECTION_RULES` in
  `languages.py` (more-specific scripts first).
- TypeScript: mirror it in `DETECTION_RULES` in
  `web/packages/core/src/language-detect.ts`.

Document the ordering rationale in the comment (more-specific scripts
must be tested first).

### 6. Golden set + evaluation

- Add a Faker locale to `_LOCALES` and a `_GenericSpec` phrase table
  (request / minutes / inquiry templates + a phone generator) to
  `_GENERIC_SPECS` in `src/prompt_anonymizer/evals/generate.py` (ja/en
  keep bespoke builders). Verify the Faker locale produces sane,
  process-deterministic names/cities (curate lists like `_VN_CITIES` /
  `_IT_CITIES` when it does not).
- Regenerate: `uv run python -m prompt_anonymizer.evals` (rewrites
  `tests/golden/golden_<lang>.json` and the spaCy table in
  `docs/EVAL.md`), then the HF table
  (`--ner-backend hf --output /tmp/eval_hf.md --golden-dir /tmp/golden_hf`,
  copy the table) and the TS table
  (`node scripts/eval-golden.mjs` in `web/packages/core` after
  `pnpm build`).
- Add recall floors to `tests/eval/test_accuracy_regression.py` for the
  entities that are strong enough to gate on.

CI guards: `tests/unit/test_golden_freshness.py` fails when
`generate.py` changes without regenerating the golden JSON, and the
`eval-golden.mjs --check` CI step fails when the TS table in
`docs/EVAL.md` is stale.

### 7. UI samples and round-trip tests

- Sample paragraphs: `SAMPLES` in `web/packages/core/src/samples.ts` (imported by
  `web/apps/web/src/main.ts` and `web/apps/proxy-admin/src/main.ts`), defaults in
  `demo/demo_openai.py` and per-target scenarios in `demo/scripts/lang-data.mjs`.
  (Pickers update automatically from the registry.)
- Round-trip tests in both cores: anonymize → deanonymize identity for a
  sample text (`tests/integration/test_pipeline.py`,
  `web/packages/core/test/anonymizer.test.ts`), plus e2e cases in
  `web/e2e/tests/web-app.spec.ts` (offline) and `ner.spec.ts` (weekly).

### 8. Docs

- `docs/i18n/locales/<lang>.yaml` — README translation source (section bodies).
  Regenerate outputs with `uv run python scripts/render_readme_i18n.py`.
  `docs/i18n/README_<lang>.md` and the language switcher are generated;
  edit the locale YAML instead of the markdown files by hand.
  `tests/unit/test_languages.py` fails until the locale file exists and
  rendered output is fresh (`render_readme_i18n.py --check`).
- READMEs keep their ja/en/es/vi label columns; other languages'
  labels live in `labels/*.yaml` / TS `LABELS` (linked after the table).
- `CHANGELOG.md` entry (labels are additive; existing mappings stay
  valid).

### 9. Full verification

```bash
uv run pytest -m "not slow" && uv run ruff check . && uv run ruff format --check src tests demo && uv run mypy src
cd web && pnpm test && pnpm lint && pnpm build && pnpm e2e
node packages/core/scripts/eval-golden.mjs --check   # from web/packages/core
```

## CI coverage summary

| Guard | Where it runs |
|---|---|
| Registry ⟷ labels/models/golden/README consistency | `tests/unit/test_languages.py` (python job) |
| Python labels YAML ⟷ TS `LABELS` byte parity | `test/labels-parity.test.ts` (web job) |
| Golden JSON freshness vs `generate.py` | `tests/unit/test_golden_freshness.py` (python job) |
| TS eval table freshness vs recognizers | `eval-golden.mjs --check` step (web job) |
| Cross-core behavioural parity on golden cases | `test/golden-parity.test.ts` + `web-golden-roundtrip.spec.ts` |
| Accuracy floors per language | `test_accuracy_regression.py` (weekly, `-m slow`) |
