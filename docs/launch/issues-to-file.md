# Issues to file — contributor on-ramp

A repository with zero open issues reads as "done or dormant" to arriving
visitors. File these (copy title + body, add the suggested labels) right
after the launch traffic starts — see step 7 of [CHECKLIST.md](CHECKLIST.md).
They are decomposed from `IMPLEMENTATION_PLAN.md` / the roadmap so each one
is self-contained and most are newcomer-friendly.

Suggested labels to create first: `good first issue`, `help wanted`,
`recognizer`, `new-language`, `infra`, `docs`.

---

## 1. Add an 11th language (e.g. Hindi `hi` or Arabic `ar`)

Labels: `help wanted`, `new-language`

The core is now registry-driven (`languages.py` / `languages.ts`), so a
new language is one registry entry + one `labels/*.yaml` + a README
translation, with the CI parity guards pointing at every remaining gap
(model, phone recognizer, golden set). Follow `docs/ADDING_A_LANGUAGE.md`
step by step; pick a language with an available spaCy pipeline (or a
multilingual HRL fallback) and a checksum-friendly national-ID/phone
format. Both cores must stay in behavioural parity.

## 2. Add UK phone number formats to PHONE_NUMBER

Labels: `good first issue`, `recognizer`

`detectWithRegex` (TS) and the Presidio recognizers (Python) cover the ten
supported locales (JP, US/NANP, ES, VI, CN, KR, FR, DE, PT, IT). Add UK
landline/mobile patterns (+44, 07…,
grouped forms) with bounded quantifiers (ReDoS: see AGENTS.md P1), plus
golden-set cases in both cores.

## 3. Opt-in `AGE` / date-of-birth entity

Labels: `help wanted`, `recognizer`

Design + implement an opt-in entity for explicit birthdates (not every
date). Needs a written scope note first (what formats, what's out of
scope) — comment on the issue before coding.

## 4. Improve LOCATION recall for partial Japanese addresses

Labels: `help wanted`

LOCATION is our weakest entity (see docs/EVAL.md). Investigate whether a
gazetteer of prefecture/city prefixes (都道府県 + 市区町村) as a
structured recognizer can catch partial addresses the NER models miss,
without tanking precision. Start with a failure analysis on the ja golden
set.

## 5. Windows CI leg for the Python test suite

Labels: `good first issue`, `infra`

`ci.yml` runs on ubuntu only. Add a `windows-latest` matrix entry for
`uv run pytest -m "not slow"` (spaCy model download included). Fix any
path-separator assumptions it flushes out.

## 6. `scan --diff` mode: read a unified diff and report only added lines

Labels: `help wanted`

`git diff --cached -U0 | prompt-anonymizer scan` currently scans the whole
diff text, so findings in context lines and diff headers can confuse
line numbers. Parse unified-diff hunks and report real file:line positions
for added lines only. Both CLIs, matching JSON output.

## 7. Homebrew cask / winget manifest for the desktop app

Labels: `good first issue`, `infra`

Write and submit a Homebrew cask (macOS `.dmg`) and a winget manifest
(Windows `.msi`) pointing at the GitHub Release assets, plus a
release-checklist note on bumping them. No code changes.

## 8. Firefox port of the browser extension

Labels: `help wanted`

The extension is Manifest V3 with a side panel. Investigate what a Firefox
port needs (sidebar API differences, `browser.*` vs `chrome.*`,
transformers.js/WASM support) and land a `web/apps/extension` build target
for it. An initial findings write-up on the issue is a fine first step.

## 9. Docs: annotated "read the source in one sitting" tour

Labels: `good first issue`, `docs`

A short doc that walks a security reviewer through the codebase in reading
order (core types → recognizers → labeling → session → surfaces), with a
one-line summary per file and links. Complements docs/AUDIT.md.

## 10. Reproducible-build check for the Pages bundle

Labels: `help wanted`, `infra`

"Verify the deployed app matches the source" currently means building it
yourself. Add a CI job that builds `web/apps/web` twice (or compares
against the Pages artifact) and documents the diff procedure, moving the
claim from "trust CI" toward "verify yourself".

## 11. Opt-in granular redaction policies (per-locale)

Labels: `help wanted`

Today every detected span is fully replaced with a reversible label
(`<人名_1>`, `<電話番号_1>`, …). Some workflows want to **preserve
coarse-grained context** while masking the rest — e.g. surname-only hints
for names, phone area/exchange prefixes, Japanese addresses down to
都道府県 + 市区町村.

**Not a quick recognizer patch.** Rules differ by locale and jurisdiction:

| Dimension | Examples of variation |
|---|---|
| Names | family/given order, patronymics, cultures without surnames |
| Phones | JP 市外局番/携帯 prefix vs NANP area code vs national trunk codes |
| Addresses | JP 都道府県/市区町村 vs US state + ZIP vs EU street/postcode norms |
| Law | APPI, GDPR, sector rules — what may remain without becoming personal data |

**Scope before coding** (comment on the issue; do not open a PR until agreed):

1. Per-locale policy matrix: which entity types support which preservation
   levels, all **default-off** and opt-in via `entities` / CLI / proxy config.
2. Output shape: literal partial text vs extended labels — implications for
   `mapping`, deanonymize round-trip, and **P0** leak risk (mapping must not
   expose more than the chosen policy allows).
3. Golden-set cases + round-trip tests in **both** cores (parity contract).
4. ReDoS-safe split parsers inside existing span boundaries (AGENTS.md P1).

Start with one reference locale (likely `ja`). Preserved fragments may still
be quasi-identifying — document that in README limitations.

---

Filing tips: one issue per item, link back to the roadmap section, and add
a "mentoring available" note on the `good first issue` ones — response
time on a newcomer's first question decides whether they finish the PR.
