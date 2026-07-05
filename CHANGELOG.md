# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
