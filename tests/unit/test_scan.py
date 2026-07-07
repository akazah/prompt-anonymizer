"""Unit tests for the engine-free structured scan (no spaCy models needed)."""

from prompt_anonymizer.scan import (
    STRUCTURED_ENTITIES,
    detect_structured,
    guess_language,
    scan_text,
)


def test_guess_language_matches_ts_heuristic() -> None:
    assert guess_language("山田さんに連絡") == "ja"
    assert guess_language("カタカナのみ") == "ja"
    assert guess_language("Call me maybe") == "en"
    assert guess_language("") == "en"
    assert guess_language("Gọi cho tôi nhé") == "vi"
    assert guess_language("¿Cómo estás?") == "es"
    # Vietnamese wins over Spanish when both marker sets appear (TS parity).
    assert guess_language("Số điện thoại, ¿vale?") == "vi"


def test_guess_language_new_languages() -> None:
    assert guess_language("请给我打电话") == "zh"
    assert guess_language("전화해 주세요") == "ko"
    assert guess_language("größere Straße") == "de"
    assert guess_language("informação não recebida") == "pt"
    assert guess_language("ça marche très bien") == "fr"
    assert guess_language("la città è però lontana") == "it"
    # Kana wins over han (ja before zh); hangul wins over everything Latin.
    assert guess_language("山田さんは北京にいる") == "ja"
    assert guess_language("서울 kontakt") == "ko"


def test_scan_text_detects_structured_pii() -> None:
    spans = scan_text("Mail john@example.com or call 090-1234-5678.")
    types = {s.entity_type for s in spans}
    assert types == {"EMAIL_ADDRESS", "PHONE_NUMBER"}


def test_scan_text_detects_credit_card_next_to_cjk() -> None:
    spans = scan_text("カード番号は4111111111111111です")
    assert [s.entity_type for s in spans] == ["CREDIT_CARD"]


def test_scan_text_detects_valid_my_number_only() -> None:
    # 123456789018 passes the MIC check digit; ...12 does not.
    assert [s.entity_type for s in scan_text("番号: 1234-5678-9018")] == ["JP_MY_NUMBER"]
    assert scan_text("番号: 1234-5678-9012") == []


def test_scan_text_detects_es_vi_phones_language_scoped() -> None:
    # Auto language guess picks the es / vi phone patterns from the prose.
    es = scan_text("Llámame al 612 345 678, ¿vale?")
    assert any(s.entity_type == "PHONE_NUMBER" for s in es)
    vi = scan_text("Gọi cho tôi ở 0912 345 678")
    assert any(s.entity_type == "PHONE_NUMBER" for s in vi)
    # The same digits in English prose must not fire (language-scoped rules).
    assert scan_text("Order id 0912 345 678 shipped") == []
    assert scan_text("Gọi cho tôi ở 0912 345 678", language="en") == []


def test_scan_text_clean_text_returns_empty() -> None:
    assert scan_text("nothing sensitive here") == []


def test_scan_text_allow_list_suppresses_finding() -> None:
    text = "Contact support@example.com for help"
    assert scan_text(text) != []
    assert scan_text(text, allow_list=["support@example.com"]) == []


def test_scan_text_deny_list_flags_custom_terms() -> None:
    spans = scan_text("ProjectXの件、進めます", deny_list=["ProjectX"])
    assert [s.entity_type for s in spans] == ["CUSTOM"]
    assert (spans[0].start, spans[0].end) == (0, 8)


def test_scan_text_merges_overlapping_spans() -> None:
    # A deny term equal to a detected email produces one merged finding,
    # not two overlapping reports of the same range.
    text = "john@example.com"
    spans = scan_text(text, deny_list=["john@example.com"])
    assert len(spans) == 1
    assert (spans[0].start, spans[0].end) == (0, len(text))


def test_scan_text_respects_score_threshold() -> None:
    # A bare NNN-NNNN postal candidate scores 0.3 without engine context
    # boosts and must stay below the default 0.4 threshold (parity with
    # the TS core, where the bare rule scores 0.35).
    assert scan_text("ref 123-4567 end") == []


def test_detect_structured_reports_raw_spans() -> None:
    spans = detect_structured("john@example.com")
    assert all(s.entity_type in STRUCTURED_ENTITIES for s in spans)
    assert any(s.entity_type == "EMAIL_ADDRESS" for s in spans)
