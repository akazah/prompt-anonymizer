"""Golden-set label round-trip (anonymize spans -> deanonymize identity).

Uses committed ``tests/golden/*.json`` with perfect spans (no NER) so PR CI
stays fast. Name-part spans in the golden set are evaluation ground truth only;
``apply_labels`` receives the parent PERSON spans and derives parts via
``split_person_names``.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from prompt_anonymizer.evals.metrics import NAME_PART_TYPES
from prompt_anonymizer.labeling import EntitySpan, apply_labels, deanonymize, load_labels
from prompt_anonymizer.languages import LANGUAGES, SUPPORTED_LANGUAGES

GOLDEN_DIR = Path(__file__).resolve().parents[1] / "golden"


@pytest.mark.parametrize("language", SUPPORTED_LANGUAGES)
def test_golden_split_name_label_roundtrip(language: str) -> None:
    cases = json.loads((GOLDEN_DIR / f"golden_{language}.json").read_text(encoding="utf-8"))
    labels = load_labels(language)
    family_first = LANGUAGES[language].family_name_first

    for case in cases:
        spans = [
            EntitySpan(s["start"], s["end"], s["entity_type"], 1.0)
            for s in case["spans"]
            if s["entity_type"] not in NAME_PART_TYPES
        ]
        anonymized, mapping = apply_labels(
            case["text"],
            spans,
            labels,
            split_person_names=True,
            family_name_first=family_first,
        )
        assert deanonymize(anonymized, mapping) == case["text"]
