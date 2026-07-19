"""Detection-view normalization (NFC + language folds) and offset mapping."""

from prompt_anonymizer.labeling import EntitySpan
from prompt_anonymizer.languages import LANGUAGES
from prompt_anonymizer.normalize import normalize_for_detect


def test_nfc_composes_combining_marks_and_maps_offsets() -> None:
    # e + combining acute → é (one code point from two)
    original = "cafe\u0301 090-1234-5678"
    view = normalize_for_detect(original, "en")
    assert "é" in view.text
    assert "\u0301" not in view.text
    # Phone digits are unchanged ASCII; span on the view must map back exactly.
    phone = "090-1234-5678"
    start = view.text.index(phone)
    end = start + len(phone)
    orig_start, orig_end = view.map_span(start, end)
    assert original[orig_start:orig_end] == phone


def test_ja_folds_halfwidth_katakana_with_voicing() -> None:
    original = "ﾔﾏﾀﾞ ﾀﾛｳ"
    view = normalize_for_detect(original, "ja")
    assert view.text == "ヤマダ タロウ"
    start, end = view.map_span(0, len(view.text))
    assert original[start:end] == original


def test_ja_fold_maps_phone_span_past_halfwidth_name() -> None:
    original = "担当のﾔﾏﾀﾞです。090-1234-5678"
    view = normalize_for_detect(original, "ja")
    assert "ヤマダ" in view.text
    phone = "090-1234-5678"
    start = view.text.index(phone)
    end = start + len(phone)
    mapped = view.map_spans(
        [EntitySpan(start=start, end=end, entity_type="PHONE_NUMBER", score=0.9)]
    )
    assert original[mapped[0].start : mapped[0].end] == phone


def test_en_does_not_fold_halfwidth_katakana() -> None:
    original = "ｶﾀｶﾅ"
    view = normalize_for_detect(original, "en")
    assert view.text == original  # NFC only; no ja fold


def test_ja_detect_folds_registered() -> None:
    assert LANGUAGES["ja"].detect_folds == ("halfwidth_katakana",)
    assert LANGUAGES["en"].detect_folds == ()
