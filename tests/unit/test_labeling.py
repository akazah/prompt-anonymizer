"""Unit tests for label assignment and replacement (no NLP engine needed)."""

from prompt_anonymizer.labeling import (
    EntitySpan,
    apply_labels,
    deanonymize,
    load_labels,
    merge_spans,
)

LABELS_JA = {"PERSON": "人名", "PHONE_NUMBER": "電話番号"}
LABELS_EN = {"PERSON": "Name", "EMAIL_ADDRESS": "Email"}


def test_apply_labels_basic() -> None:
    text = "山田太郎の電話は090-1234-5678"
    spans = [
        EntitySpan(0, 4, "PERSON", 0.9),
        EntitySpan(8, 21, "PHONE_NUMBER", 0.8),
    ]
    result, mapping = apply_labels(text, spans, LABELS_JA)
    assert result == "<人名_1>の電話は<電話番号_1>"
    assert mapping == {"<人名_1>": "山田太郎", "<電話番号_1>": "090-1234-5678"}


def test_same_source_gets_same_label() -> None:
    text = "John met John and Jane"
    spans = [
        EntitySpan(0, 4, "PERSON", 0.9),
        EntitySpan(9, 13, "PERSON", 0.9),
        EntitySpan(18, 22, "PERSON", 0.9),
    ]
    result, mapping = apply_labels(text, spans, LABELS_EN)
    assert result == "<Name_1> met <Name_1> and <Name_2>"
    assert mapping == {"<Name_1>": "John", "<Name_2>": "Jane"}


def test_label_numbering_beyond_62() -> None:
    """The legacy single-character encoding broke after 62 items."""
    names = [f"Person{i:03d}" for i in range(70)]
    text = " ".join(names)
    spans = []
    offset = 0
    for name in names:
        spans.append(EntitySpan(offset, offset + len(name), "PERSON", 0.9))
        offset += len(name) + 1
    result, mapping = apply_labels(text, spans, LABELS_EN)
    assert "<Name_63>" in result
    assert "<Name_70>" in result
    assert len(mapping) == 70


def test_merge_spans_prefers_higher_score() -> None:
    spans = [
        EntitySpan(0, 10, "PERSON", 0.5),
        EntitySpan(5, 15, "LOCATION", 0.9),
    ]
    merged = merge_spans(spans)
    assert merged == [EntitySpan(5, 15, "LOCATION", 0.9)]


def test_merge_spans_keeps_non_overlapping() -> None:
    spans = [
        EntitySpan(0, 4, "PERSON", 0.5),
        EntitySpan(10, 14, "PERSON", 0.9),
    ]
    assert len(merge_spans(spans)) == 2


def test_deanonymize_roundtrip() -> None:
    text = "山田太郎の電話は090-1234-5678。山田太郎に連絡。"
    spans = [
        EntitySpan(0, 4, "PERSON", 0.9),
        EntitySpan(8, 21, "PHONE_NUMBER", 0.8),
        EntitySpan(22, 26, "PERSON", 0.9),
    ]
    anonymized, mapping = apply_labels(text, spans, LABELS_JA)
    assert deanonymize(anonymized, mapping) == text


def test_deanonymize_longest_label_first() -> None:
    mapping = {"<Name_1>": "John", "<Name_11>": "Jane"}
    assert deanonymize("<Name_11> and <Name_1>", mapping) == "Jane and John"


def test_load_labels_packaged() -> None:
    ja = load_labels("ja")
    en = load_labels("en")
    assert ja["PERSON"] == "人名"
    assert en["PERSON"] == "Name"
    assert set(ja) == set(en)
