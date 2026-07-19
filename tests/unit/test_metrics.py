"""Unit tests for the span-level evaluation metrics."""

import pytest

from prompt_anonymizer.evals.generate import GoldenCase, GoldenSpan, generate_cases
from prompt_anonymizer.evals.metrics import EntityMetrics, evaluate_cases, evaluate_name_parts
from prompt_anonymizer.labeling import EntitySpan


def _case(text: str, spans: list[GoldenSpan]) -> GoldenCase:
    return GoldenCase(id="t-0001", language="ja", genre="request", text=text, spans=spans)


def test_perfect_prediction() -> None:
    case = _case("山田太郎です", [GoldenSpan(0, 4, "PERSON", "山田太郎")])
    report = evaluate_cases([case], [[EntitySpan(0, 4, "PERSON", 0.9)]])
    m = report.per_entity["PERSON"]
    assert (m.precision, m.recall, m.f1) == (1.0, 1.0, 1.0)


def test_partial_overlap_counts_as_hit() -> None:
    case = _case("山田太郎です", [GoldenSpan(0, 4, "PERSON", "山田太郎")])
    report = evaluate_cases([case], [[EntitySpan(0, 2, "PERSON", 0.9)]])
    assert report.per_entity["PERSON"].recall == 1.0


def test_wrong_entity_type_is_fp_and_fn() -> None:
    case = _case("山田太郎です", [GoldenSpan(0, 4, "PERSON", "山田太郎")])
    report = evaluate_cases([case], [[EntitySpan(0, 4, "LOCATION", 0.9)]])
    assert report.per_entity["PERSON"].false_negatives == 1
    assert report.per_entity["LOCATION"].false_positives == 1


def test_missing_prediction_is_fn() -> None:
    case = _case("山田太郎です", [GoldenSpan(0, 4, "PERSON", "山田太郎")])
    report = evaluate_cases([case], [[]])
    m = report.per_entity["PERSON"]
    assert m.recall == 0.0
    assert m.f1 == 0.0


def test_entities_filter() -> None:
    case = _case(
        "山田太郎 090-1234-5678",
        [
            GoldenSpan(0, 4, "PERSON", "山田太郎"),
            GoldenSpan(5, 18, "PHONE_NUMBER", "090-1234-5678"),
        ],
    )
    report = evaluate_cases([case], [[]], entities=["PHONE_NUMBER"])
    assert "PERSON" not in report.per_entity
    assert report.per_entity["PHONE_NUMBER"].false_negatives == 1


def test_length_mismatch_raises() -> None:
    with pytest.raises(ValueError):
        evaluate_cases([_case("a", [])], [])


def test_markdown_rows() -> None:
    case = _case("山田太郎です", [GoldenSpan(0, 4, "PERSON", "山田太郎")])
    report = evaluate_cases([case], [[EntitySpan(0, 4, "PERSON", 0.9)]])
    rows = report.to_markdown_rows()
    assert rows == ["| ja | PERSON | 1.00 | 1.00 | 1.00 | 1 |"]


def test_empty_metrics_are_zero() -> None:
    m = EntityMetrics(entity_type="PERSON")
    assert (m.precision, m.recall, m.f1) == (0.0, 0.0, 0.0)


def test_generate_cases_include_name_part_spans() -> None:
    cases = generate_cases("en", count=5)
    for case in cases:
        persons = [s for s in case.spans if s.entity_type == "PERSON"]
        parts = [s for s in case.spans if s.entity_type.startswith("PERSON_")]
        assert persons
        assert parts
        for person in persons:
            part_spans = [
                s
                for s in parts
                if person.start <= s.start and s.end <= person.end
            ]
            assert len(part_spans) >= 2
            assert case.text[person.start : person.end] == " ".join(s.value for s in part_spans)


def test_evaluate_name_parts_perfect_on_generated() -> None:
    cases = generate_cases("en", count=20)
    report = evaluate_name_parts(cases, family_name_first=False)
    for entity in ("PERSON_FIRST_NAME", "PERSON_LAST_NAME"):
        assert entity in report.per_entity
        m = report.per_entity[entity]
        assert m.recall == 1.0
        assert m.precision == 1.0


def test_evaluate_name_parts_family_first() -> None:
    cases = generate_cases("ja", count=20)
    report = evaluate_name_parts(cases, family_name_first=True)
    for entity in ("PERSON_FIRST_NAME", "PERSON_LAST_NAME"):
        m = report.per_entity[entity]
        assert m.recall == 1.0


def test_generate_cases_is_seeded_and_offsets_correct() -> None:
    a = generate_cases("ja", count=10)
    b = generate_cases("ja", count=10)
    assert [c.text for c in a] == [c.text for c in b]
    for case in a:
        for span in case.spans:
            assert case.text[span.start : span.end] == span.value
