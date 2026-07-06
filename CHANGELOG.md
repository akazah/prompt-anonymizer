# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Playwright e2e suite (`web/e2e/`) covering the browser app and the real
  MV3 Chrome extension: anonymize → mapping → restore round trips, label
  consistency, golden-set round-trip identity through the UI, and
  `chrome.storage.session` mapping persistence. The default suite is
  regex-only and fully offline — every test asserts no request leaves the
  device — and runs in PR CI; an opt-in `ner` project (`pnpm e2e:ner`)
  exercises the full transformers.js pipeline with a cached model profile
  and runs in the weekly workflow.
- Python: optional transformer NER backend (`PromptAnonymizer(ner_backend="hf")`,
  CLI `--ner-backend hf`, `pip install "prompt-anonymizer[hf]"`). Adds a
  Presidio `HuggingFaceNerRecognizer` on top of spaCy using the same model
  family the TypeScript core runs via transformers.js
  (`tsmatz/xlm-roberta-ner-japanese`, `dslim/bert-base-NER`), fully
  on-device. Golden-set ja PERSON recall goes 0.82 → 1.00 and ja LOCATION
  recall 0.78 → 1.00 (see docs/EVAL.md).
- Python: `PromptAnonymizer.anonymize_batch(texts, language, batch_size,
  n_process)` built on Presidio's `BatchAnalyzerEngine` (spaCy `nlp.pipe`);
  the eval harness and accuracy-regression tests now use it instead of a
  per-case loop.
- CREDIT_CARD detection in both cores and all languages (was Python/en
  only, and undetected next to CJK text): a CJK-safe variant of Presidio's
  credit card pattern (lookarounds instead of `\b`) with Luhn validation,
  a matching TS regex recognizer, golden-set coverage and recall floors.
- Python: US/NANP phone regex fallback recognizer (parity with the TS
  core). Presidio's `PhoneRecognizer` validates against libphonenumber and
  rejects well-formed numbers with unassigned area codes; golden-set en
  PHONE_NUMBER recall goes 0.89 → 1.00.
- TS core: on-device language auto-detection helper (`detectLanguage`,
  `guessLanguage`). Uses Chrome's built-in `LanguageDetector` API
  (Chrome 138+, on-device expert model; never triggers a model download)
  with a script-range heuristic fallback everywhere else. The browser app
  and Chrome extension language selectors gained an "Auto" option
  (default in the extension flow for context-menu imports).

### Changed
- Both cores: `mergeSpans` / `merge_spans` no longer drop an overlapping
  lower-score span entirely — the parts not covered by kept spans survive
  as whitespace-trimmed remainder spans. Previously an NER address span
  overlapping an already-masked postal code was discarded whole, leaking
  the address text (e.g. `〒539-6608 福井県鴨川市…` kept the 福井県… part
  unmasked when NER covered both). Covered by new tests in both cores plus
  round-trip assertions.
- Python: Presidio's context enhancement now runs in `whole_word` mode
  (new in presidio-analyzer 2.2.361) instead of the default substring mode,
  which could false-boost when a context word appears inside an unrelated
  token (e.g. "TEL" in "hotel"). Golden-set metrics are unchanged. The
  JP postal recognizer's context list gained 郵便 (Sudachi splits 郵便番号
  into 郵便/番号, so the compound alone never matched a single lemma).
- Python: regex execution is now capped via `REGEX_TIMEOUT_SECONDS=5`
  (Presidio 2.2.362 feature; its default is 60s) as ReDoS
  defense-in-depth. Override by exporting the variable.

### Removed
- `presidio-anonymizer` dependency: it was declared but never imported —
  replacement/labeling has always been the custom reversible-label engine
  in `labeling.py`.

### Fixed
- TS core: NER no longer errors with "no available backend found. ERR:
  [webgpu] TypeError: … webgpuInit is not a function" on Safari/WebKit
  (iOS/macOS Safari 26, Tauri's WKWebView). transformers.js <= 4.2 serves
  Safari a WASM build without WebGPU support, and a failed WebGPU session
  creation poisons its internal init chain so the runtime WASM retry
  rethrows the same error; `detectWebGpu()` therefore now reports false on
  Safari/WebKit and NER goes straight to WASM there.
- TS core: NER now falls back to WASM at runtime when ONNX Runtime's WebGPU
  init fails despite a WebGPU adapter being detected. Failed model loads are
  also no longer cached, so a network error during download can be retried
  without reloading the page. The browser app's engine badge now reflects
  the device actually in use.
- TS core: upgraded transformers.js 3.x → 4.x. v3's WebGPU execution provider mis-executed
  `DequantizeLinear` on int8/q8 models ([transformers.js#1512](https://github.com/huggingface/transformers.js/issues/1512)),
  so NER silently returned no PERSON/LOCATION spans on WebGPU devices — names like 山田太郎
  stayed unmasked while regex entities (email, phone) were still replaced.
- Browser app & Chrome extension: show an explicit warning while the NER toggle is off,
  since names and locations are not masked in regex-only mode.

### Changed
- **BREAKING**: minimum supported Python is now 3.12 (was 3.10). Python 3.10
  reaches EOL in October 2026 and 3.11 is in security-only maintenance; new
  installs should use 3.12+. Anonymization behavior and the label format are
  unchanged.
- Toolchain modernization (no behavior or label-format changes):
  - Web: TypeScript 5.7 -> 6.0, Vite 6 -> 8 (Rolldown), Vitest 3 -> 4,
    transformers.js 3.x -> 4.x (also a bug fix - see Fixed above),
    `@types/chrome` 0.0.x -> 0.2.x, pnpm 10 -> 11.
  - CI: Node 22 -> 24 (Active LTS) and all GitHub Actions bumped to their
    latest majors.
  - Dev default Python 3.12 -> 3.13 (`.python-version`). Python 3.14 is
    still out of reach: the spaCy stack ships no 3.14 wheels yet.

## [0.2.0] - 2026-07-05

### Added
- TS core: target-agnostic restore layer (`RestoreSession`, `MappingStore` port, `restoreText`, `findPlaceholders`) so every frontend replaces mask placeholders in LLM replies through the same interface; the restore result now reports replacement counts and unresolved (model-invented or lost) labels, surfaced as a warning in the browser app and Chrome extension.
- Reversible anonymization: `PromptAnonymizer.anonymize()` now returns a `mapping` and `deanonymize()` restores original values from LLM responses.
- New label format `<人名_1>` / `<Name_1>` with unlimited numbering (the legacy single-character suffix broke after 62 entities).
- Japanese detection improvements: JP-region phone recognizer, regex fallback for JP phone notation variants, postal code recognizer (〒NNN-NNNN), and a My Number recognizer with check-digit validation.
- `deny_list` / `allow_list` options to force or exempt specific strings.
- typer-based CLI: `prompt-anonymizer anonymize|deanonymize` with `--json`, `--interactive`, `--mapping-file`.
- Evaluation harness (`python -m prompt_anonymizer.evals`) producing span-level precision/recall/F1 in `docs/EVAL.md`, plus a JSON golden set shared with the TypeScript core.
- TypeScript core `@prompt-anonymizer/core` (regex recognizers + transformers.js NER with WebGPU/WASM).
- Browser app (GitHub Pages), Chrome extension (MV3 side panel), and Tauri 2 desktop app for Windows/macOS/Linux.
- CI (lint, type check, tests, coverage gate), PyPI Trusted Publishing release workflow, multi-target release workflow, GitHub Pages deploy, and weekly accuracy evaluation.
- Scripted, reproducible demo GIFs (vhs tapes + Playwright screencast scripts).

### Changed
- Migrated from poetry to uv, PEP 621 metadata, src layout.
- OpenAI is no longer a core dependency; the demo uses the v1 SDK via the `demo` extra.

### Removed
- Legacy hash-based two-step replacement (could mis-replace on partial hash collisions).
- `fire` CLI and `colorama` dependency.

## [0.1.0] - 2023-06-03

Initial demo scripts.
