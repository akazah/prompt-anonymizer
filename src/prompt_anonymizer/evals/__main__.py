"""Run the evaluation harness: ``uv run python -m prompt_anonymizer.evals``.

Generates the seeded golden set, runs the anonymizer, writes span-level
metrics to ``docs/EVAL.md`` and exports the golden set as JSON to
``tests/golden/`` for parity testing with the TypeScript core.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from prompt_anonymizer.core import DEFAULT_ENTITIES, OPTIONAL_ENTITIES, PromptAnonymizer
from prompt_anonymizer.evals.generate import generate_cases
from prompt_anonymizer.evals.metrics import (
    EvalReport,
    evaluate_cases,
    evaluate_name_parts,
    merge_reports,
)
from prompt_anonymizer.languages import LANGUAGES, SUPPORTED_LANGUAGES

PY_START = "<!-- python-eval:start -->"
PY_END = "<!-- python-eval:end -->"

DOC_TEMPLATE = f"""# Accuracy (span-level, synthetic golden set)

Cases are seeded Faker documents (request / minutes / inquiry genres) with
ground-truth spans. Detection is best-effort; these numbers exist to catch
regressions, not to promise recall on real-world text. PERSON name-part rows
(`PERSON_FIRST_NAME` / `PERSON_MIDDLE_NAME` / `PERSON_LAST_NAME`) score the
``split_person_name`` heuristic on composed multi-token names in the golden
set (exact span match, no NER).

## Python core (Presidio + spaCy)

Regenerate with `uv run python -m prompt_anonymizer.evals`.

{PY_START}
{PY_END}

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
"""

TABLE_HEADER = (
    "| Language | Entity | Precision | Recall | F1 | Support |\n|---|---|---|---|---|---|\n"
)


def main() -> None:
    parser = argparse.ArgumentParser(description="prompt-anonymizer evaluation harness")
    parser.add_argument("--cases", type=int, default=200, help="cases per language")
    parser.add_argument("--languages", nargs="+", default=list(SUPPORTED_LANGUAGES))
    parser.add_argument("--model-size", default="sm", choices=["sm", "lg"])
    parser.add_argument(
        "--ner-backend",
        default="spacy",
        choices=["spacy", "hf"],
        help="NER backend; 'hf' needs the hf extra and downloads models on first use",
    )
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--output", type=Path, default=Path("docs/EVAL.md"))
    parser.add_argument("--golden-dir", type=Path, default=Path("tests/golden"))
    args = parser.parse_args()

    reports: list[EvalReport] = []
    args.golden_dir.mkdir(parents=True, exist_ok=True)

    for language in args.languages:
        cases = generate_cases(language, count=args.cases)
        golden_path = args.golden_dir / f"golden_{language}.json"
        golden_path.write_text(
            json.dumps([c.to_dict() for c in cases], ensure_ascii=False, indent=1),
            encoding="utf-8",
        )
        print(f"[{language}] exported {len(cases)} cases -> {golden_path}")

        pa = PromptAnonymizer(
            languages=[language],
            model_size=args.model_size,
            ner_backend=args.ner_backend,
            entities=[*DEFAULT_ENTITIES, *OPTIONAL_ENTITIES],
        )
        results = pa.anonymize_batch(
            [case.text for case in cases], language=language, batch_size=args.batch_size
        )
        print(f"[{language}] analyzed {len(cases)} cases (batched)")
        detection = evaluate_cases(cases, [r.entities for r in results])
        parts = evaluate_name_parts(cases, family_name_first=LANGUAGES[language].family_name_first)
        reports.append(merge_reports(detection, parts))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    section = [TABLE_HEADER]
    for report in reports:
        section.extend(row + "\n" for row in report.to_markdown_rows())
    section.append(
        f"\nModel size: `{args.model_size}` / NER backend: `{args.ner_backend}` / "
        f"cases per language: {args.cases} (seed fixed).\n"
    )

    # Replace only the marked Python block so the TS section survives.
    doc = args.output.read_text(encoding="utf-8") if args.output.exists() else DOC_TEMPLATE
    if PY_START not in doc or PY_END not in doc:
        doc = DOC_TEMPLATE
    before, rest = doc.split(PY_START, 1)
    _, after = rest.split(PY_END, 1)
    doc = before + PY_START + "\n" + "".join(section) + PY_END + after
    args.output.write_text(doc, encoding="utf-8")
    print(f"wrote {args.output}")


if __name__ == "__main__":
    main()
