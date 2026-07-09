# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Positioning: framed the product as a **buddy check / poka-yoke** — a
  second-layer, on-device double-check that backs up the "don't paste that
  into an LLM" rule teams already have — rather than a primary "use frontier
  LLMs without showing them your PII" guarantee. Rewrote the README headline,
  lead and comparison table (now "lines of defense against a PII slip") across
  all ten locale sources, plus package descriptions, web/extension/desktop UI
  copy, the social-preview card, and the Show HN / Chrome Web Store / Zenn
  launch drafts. Copy only — no behavioural change. (`demo/social-preview.png`
  regenerated for the new tagline.)
- README i18n: `README.md` and `docs/i18n/README_*.md` are now generated from
  `docs/i18n/locales/<code>.yaml` via `scripts/render_readme_i18n.py` (CI
  `--check` gate). Added missing MCP quickstart sections to eight translated
  READMEs.

## [0.3.0] - 2026-07-07

### Added
- MCP server (`@prompt-anonymizer/mcp`, `web/packages/mcp`): `anonymize` /
  `deanonymize` / `scan` tools over stdio for any MCP client (Claude
  Desktop, Claude Code, Cursor, …). `anonymize` returns the masked text and
  a `mapping_id`; the label → original-value mapping stays in server memory
  and is only included when `return_mapping: true` is passed explicitly.
  `deanonymize` restores by `mapping_id` or an explicit mapping, optionally
  writing straight to a file so restored PII never enters the model
  context. `scan` mirrors the CLI gate contract: `file:line:col` and entity
  type only, never the matched text. NER is opt-in via `--ner` (off by
  default: offline and model-free), matching `scan`'s defaults.
- npm packaging polish ahead of publication: per-package `README.md` and
  `LICENSE` for `core` / `cli` / `element` / `react` / `vue` / `proxy` /
  `mcp` (the npm listing page renders the README), plus `homepage` and
  `bugs` fields in each publishable `package.json`.
- Social preview card: `demo/social-preview.png` (1280×640, generated from
  `demo/scripts/social-preview.html`) for the GitHub repo's Settings →
  Social preview slot, so shared links render a real card.
- Launch runbook and drafts under `docs/launch/`: publish checklist
  (PyPI / npm trusted publishing, Chrome Web Store listing copy),
  announcement drafts (Zenn ja article, Show HN, awesome-list blurbs) and
  prepared `good first issue` texts.
- Integration guide `docs/INTEGRATIONS.md` and self-audit guide
  `docs/AUDIT.md`.
- Six new languages — Chinese (`zh`), Korean (`ko`), French (`fr`), German
  (`de`), Portuguese (`pt`) and Italian (`it`) — bringing language support
  to ten in both cores (non-breaking, additive): locale-specific labels,
  registry-driven per-language phone recognizers (CN/KR/FR/DE/PT/IT regions
  plus regex fallbacks), spaCy pipelines (`zh_core_web_*`, `ko_core_news_*`,
  `fr/de/pt/it_core_news_*` in the `models` / `models-lg` dependency
  groups), HF / transformers.js NER via the multilingual HRL model, golden
  sets (`tests/golden/golden_{zh,ko,fr,de,pt,it}.json`, 200 cases each),
  all ten languages in every UI language picker, and script/diacritic
  auto-detection extended to all ten. Default
  `PromptAnonymizer(languages=…)` remains `("en", "ja")`.

- Language registry as single source of truth per core
  (`prompt_anonymizer.languages.SUPPORTED_LANGUAGES` /
  `SUPPORTED_LANGUAGES` from `@prompt-anonymizer/core`, also exposed via
  the dependency-free `@prompt-anonymizer/core/languages` subpath): type
  unions, CLI validation/help, language pickers, detector tags and eval
  loops all derive from it. New CI-enforced consistency guards:
  cross-core label parity (`labels/*.yaml` ⟷ TS `LABELS`, byte-exact),
  registry coverage of models/golden sets/README translations, golden-set
  freshness vs `evals/generate.py`, and a `eval-golden.mjs --check` CI
  step that fails when the TS table in `docs/EVAL.md` drifts. Adding a
  language is documented in `docs/ADDING_A_LANGUAGE.md`.
- Spanish (`es`) and Vietnamese (`vi`) support in both cores (non-breaking,
  additive): locale-specific labels (`Nombre`, `Teléfono`, `Tên`,
  `SốĐiệnThoại`, …), Spain and Vietnam phone recognizers, spaCy / HF /
  transformers.js NER models, golden sets (`tests/golden/golden_es.json`,
  `golden_vi.json`, 200 cases each), Español / Tiếng Việt in the web UI
  language picker, and auto-detection extended to distinguish `ja` / `en` /
  `es` / `vi`. Default `PromptAnonymizer(languages=…)` remains `("en", "ja")`;
  pass `languages=["es"]` or `languages=["vi"]` to opt in. Existing `ja`/`en`
  labels unchanged. Vietnamese has no official spaCy pipeline (`xx_ent_wiki_sm`
  for both model sizes); `ner_backend="hf"` (`NlpHUST/ner-vietnamese-electra-base`)
  is recommended for name/location recall. The opt-in `US_SSN` / `IBAN_CODE`
  entities get `SSN` / `IBAN` labels in both new languages, and the `scan`
  gate's language auto-detection and language-scoped phone patterns cover
  `es` / `vi` in both CLIs.
- Translated READMEs: `README_es.md` (Español) and `README_vi.md`
  (Tiếng Việt), cross-linked from the language switcher in `README.md` and
  `README_ja.md`.
- Commit-time / CI gate: new `scan` subcommand in BOTH CLIs (Python and
  Node) that exits `0` when the inputs are clean, `1` when PII is found
  and `2` on errors. It reports `file:line:col` and the entity type only —
  the matched text is never printed, keeping hook output and CI logs
  PII-free. Accepts file arguments (as passed by pre-commit / lint-staged),
  `--text` or stdin, plus repeatable `--deny` / `--allow` terms and
  `--json`. By default it is offline, deterministic and model-free
  (structured PII only: emails, phone numbers, JP postal codes, My Number,
  credit cards); `--ner` opts into name/location detection. Ships with a
  `.pre-commit-hooks.yaml` hook definition (`prompt-anonymizer-scan`) so
  other repositories can consume it via the pre-commit framework.
- Python: engine-free scan API (`prompt_anonymizer.scan`): `scan_text()` /
  `detect_structured()` run the pattern recognizers directly without
  Presidio's spaCy NLP engine (no models needed), `guess_language()`
  mirrors the TS core's script-range heuristic, and
  `STRUCTURED_ENTITIES` lists what the engine-free path covers.
  `labeling.deny_list_spans()` is now a shared public helper (parity with
  the TS core's `detectDenyList`), used by both `PromptAnonymizer` and the
  scan path.
- Opt-in structured-PII entities `US_SSN` and `IBAN_CODE` in both cores.
  They are not in the default entity set; request them via
  `PromptAnonymizer(entities=[...])` / `new Anonymizer({ entities })` or the
  new `--entities` CLI flag (Python and Node CLIs). US SSNs are detected
  with CJK-safe boundaries and Presidio's invalidation rules in both cores;
  IBANs are mod-97 checksum-validated (Presidio's built-in recognizer on
  Python, `ibantools` (MIT) in the TS core). New labels (additive only —
  existing mappings stay valid): `SSN` / `社会保障番号` and `IBAN` / `IBAN`.
- A licensing policy for new dependencies and default NER models in
  `CONTRIBUTING.md`.
- `@prompt-anonymizer/proxy` — OpenAI-compatible local reverse proxy
  (`prompt-anonymizer-proxy`, default `http://127.0.0.1:8787`): point
  `OPENAI_BASE_URL` at it and PII in `/v1/chat/completions` messages is
  masked (with request-scoped label consistency across messages) before
  the request leaves the machine; labels in the response are restored,
  including streaming SSE where a label may be split across chunks. Other
  `/v1/*` routes pass through. Mappings live in memory per request — never
  logged or persisted — unless `--record-mappings` opts into a capped
  in-memory buffer for the admin GUI's explicit reveal. Ships a localhost
  admin GUI at `/admin/` (`web/apps/proxy-admin`: live status, redaction
  events with labels/counts, config editing for upstream / NER /
  deny/allow lists, local-only anonymization playground); admin routes are
  Host-header guarded against DNS rebinding when bound to loopback.
- New JS-ecosystem targets built on the shared TS core (label format and
  mapping semantics unchanged):
  - `@prompt-anonymizer/cli` — Node CLI (`npx @prompt-anonymizer/cli`)
    mirroring the Python CLI: `anonymize` / `deanonymize` / `version`, the
    same flags (`--text/--file/stdin`, `--json`, `--interactive`,
    `--mapping-file`), the same exit codes and the same `--json` shape.
    NER (transformers.js, native CPU backend) is on by default;
    `--no-ner` prints the same "names and locations will NOT be masked"
    warning as the browser targets. Language defaults to on-device
    auto-detection (`-l en|ja|es|vi` to force).
  - `@prompt-anonymizer/element` — framework-agnostic `<prompt-anonymizer>`
    web component embedding the full anonymize → restore panel (shadow
    DOM UI mirroring the browser app, `pa-anonymize` / `pa-restore` /
    `pa-error` events, `ner` / `store` / `denyList` / `allowList` /
    `scoreThreshold` properties, `language` / `show-restore` attributes)
    for plain HTML, Svelte, Angular and any other frontend.
  - `@prompt-anonymizer/react` — drop-in `<AnonymizerPanel />` component
    (typed wrapper around the element) plus a `useAnonymizer()` hook
    wrapping `RestoreSession` (anonymize → LLM → restore with busy/error
    state and a mapping view; the mapping stays in-memory unless a custom
    `MappingStore` is injected).
  - `@prompt-anonymizer/vue` — the same `<AnonymizerPanel />` component
    and `useAnonymizer()` as a Vue 3 composable (callable outside
    component setup, e.g. in Pinia stores).
- TS core: `NerDevice` gained `"cpu"` (the native onnxruntime-node
  binding) so Node consumers can run NER; `"auto"` still only picks
  between the browser devices (webgpu/wasm).
- npm publishing workflow (`release-npm.yml`) for the
  `@prompt-anonymizer/*` packages via npm Trusted Publishing, gated
  behind the `NPM_PUBLISH` repository variable (mirrors the deferred
  PyPI setup). Package manifests gained `repository` / `keywords` /
  `publishConfig` metadata.
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
- Language support is now driven by a central registry in each core
  (`src/prompt_anonymizer/languages.py`; `LANGUAGES` / `isLanguage` /
  `LANGUAGE_NAMES` in `web/packages/core/src/types.ts`): spaCy/HF model
  resolution, phone recognizers, heuristic detection, CLI validation and
  UI pickers all derive from it, so adding a language is one registry entry
  plus a label file. The per-language `es_phone.py` / `vn_phone.py`
  recognizer modules were replaced by the registry-driven
  `recognizers/phone.py` (`build_phone_recognizers`); the golden-set
  generator's per-language builders were likewise consolidated into a
  phrase-table template (es/vi output is byte-identical).
- Heuristic language detection now distinguishes han-without-kana as `zh`
  and hangul as `ko`; kanji-only Japanese fragments are therefore guessed
  as `zh` by the offline heuristic (the browser's built-in LanguageDetector,
  when available, is unaffected).
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
- Proxy admin API and GUI now accept `es` / `vi` (config updates
  previously collapsed them to `auto`, and an `es`/`vi` configured
  language fell back to detection); admin GUI ships Spanish/Vietnamese
  sample texts and displays all language names.
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
