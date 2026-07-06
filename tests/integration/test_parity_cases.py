"""Cross-core parity cases against the hand-written fixture.

The fixture (``tests/golden/parity_cases.json``) is shared with the TS core
(``web/packages/core/test/parity-cases.test.ts``) so that per-target detection
behavior — one case per entity type and edge — is asserted identically in both
cores, including a round-trip identity check per case (AGENTS.md).
"""

import json
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

_FIXTURE = Path(__file__).resolve().parent.parent / "golden" / "parity_cases.json"
_ALL_CASES = json.loads(_FIXTURE.read_text(encoding="utf-8"))["cases"]
_CASES = [c for c in _ALL_CASES if "python" in c["cores"]]
_PLAIN = [c for c in _CASES if not c.get("deny_list") and not c.get("allow_list")]
_LISTED = [c for c in _CASES if c.get("deny_list") or c.get("allow_list")]

# One shared instance per fixture keeps spaCy model loads to two for the
# whole module. List-carrying cases run on a single instance built with the
# union of their lists (the cases do not interfere with each other's values).
_DENY = sorted({needle for c in _LISTED for needle in c.get("deny_list", [])})
_ALLOW = sorted({value for c in _LISTED for value in c.get("allow_list", [])})


@pytest.fixture(scope="module")
def pa():
    from prompt_anonymizer import PromptAnonymizer

    return PromptAnonymizer(languages=["ja", "en"], model_size="sm")


@pytest.fixture(scope="module")
def pa_listed():
    from prompt_anonymizer import PromptAnonymizer

    return PromptAnonymizer(
        languages=["ja", "en"], model_size="sm", deny_list=_DENY, allow_list=_ALLOW
    )


def _occurrences(text: str, value: str) -> list[tuple[int, int]]:
    spans = []
    at = text.find(value)
    while at != -1:
        spans.append((at, at + len(value)))
        at = text.find(value, at + 1)
    return spans


def _assert_case(pa, case) -> None:
    case_id = case["id"]
    text = case["text"]
    result = pa.anonymize(text, language=case["language"])

    for req in case.get("must_mask", []):
        value = req["value"]
        entity_type = req["entity_type"]
        min_count = req.get("min_count", 1)
        assert value not in result.text, f"{case_id}: {value!r} leaked into output"
        covered = [
            (start, end)
            for start, end in _occurrences(text, value)
            if any(
                span.entity_type == entity_type and span.start < end and start < span.end
                for span in result.entities
            )
        ]
        assert len(covered) >= min_count, (
            f"{case_id}: expected >= {min_count} {entity_type} span(s) over {value!r}, "
            f"got {len(covered)} (entities: {result.entities})"
        )
        if min_count >= 2:
            labels = [label for label, original in result.mapping.items() if original == value]
            assert len(labels) == 1, f"{case_id}: same value must reuse one label, got {labels}"

    for value in case.get("must_not_mask", []):
        assert value in result.text, f"{case_id}: {value!r} must survive verbatim"

    for req in case.get("must_not_detect", []):
        value = req["value"]
        entity_type = req["entity_type"]
        hits = [
            span
            for start, end in _occurrences(text, value)
            for span in result.entities
            if span.entity_type == entity_type and span.start < end and start < span.end
        ]
        assert not hits, f"{case_id}: forbidden {entity_type} span over {value!r}: {hits}"

    restored = pa.deanonymize(result.text, result.mapping)
    assert restored == text, f"{case_id}: round-trip identity failed"


@pytest.mark.parametrize("case", _PLAIN, ids=[c["id"] for c in _PLAIN])
def test_parity_case(pa, case) -> None:
    _assert_case(pa, case)


@pytest.mark.parametrize("case", _LISTED, ids=[c["id"] for c in _LISTED])
def test_parity_case_with_lists(pa_listed, case) -> None:
    _assert_case(pa_listed, case)
