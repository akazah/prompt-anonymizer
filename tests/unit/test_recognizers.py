"""Unit tests for custom recognizer logic (regex + check digit)."""

import pytest

from prompt_anonymizer.recognizers.my_number import is_valid_my_number, my_number_check_digit


def test_check_digit_known_value() -> None:
    # 123456789012 -> body 12345678901, check digit per MIC ordinance.
    body = "12345678901"
    digit = my_number_check_digit(body)
    assert 0 <= digit <= 9
    assert is_valid_my_number(body + str(digit))


def test_check_digit_rejects_wrong_digit() -> None:
    body = "12345678901"
    good = my_number_check_digit(body)
    bad = (good + 1) % 10
    assert not is_valid_my_number(body + str(bad))


def test_check_digit_requires_11_digits() -> None:
    with pytest.raises(ValueError):
        my_number_check_digit("123")


def test_is_valid_my_number_normalizes_separators() -> None:
    body = "98765432109"
    digit = my_number_check_digit(body)
    grouped = f"{body[:4]}-{body[4:8]}-{body[8:]}{digit}"
    assert is_valid_my_number(grouped)


def test_is_valid_my_number_rejects_wrong_length() -> None:
    assert not is_valid_my_number("1234")
    assert not is_valid_my_number("1234567890123")


def test_ja_phone_regex_patterns() -> None:
    import re

    from prompt_anonymizer.recognizers.ja_phone import JaPhoneRegexRecognizer

    patterns = {p.name: re.compile(p.regex) for p in JaPhoneRegexRecognizer.PATTERNS}
    assert patterns["jp_mobile"].search("連絡先は090-1234-5678です")
    assert patterns["jp_mobile"].search("09012345678")
    assert patterns["jp_tollfree"].search("0120-123-456")
    assert patterns["jp_landline"].search("03-1234-5678")
    assert not patterns["jp_mobile"].search("1090-1234-5678の一部")


def test_ja_phone_rejects_ssn_shaped_digit_counts() -> None:
    from prompt_anonymizer.recognizers.ja_phone import JaPhoneRegexRecognizer

    recognizer = JaPhoneRegexRecognizer()
    # 9 digits (US-SSN-shaped, e.g. 021-14-3596) is not a JP number.
    assert recognizer.validate_result("021-14-3596") is False
    # Valid 10-digit landlines keep their pattern score (None = unchanged).
    assert recognizer.validate_result("03-1234-5678") is None
    assert recognizer.validate_result("0123-45-6789") is None


def test_ja_postal_regex_patterns() -> None:
    import re

    from prompt_anonymizer.recognizers.ja_postal_code import JaPostalCodeRecognizer

    patterns = {p.name: re.compile(p.regex) for p in JaPostalCodeRecognizer.PATTERNS}
    assert patterns["jp_postal_marked"].search("〒100-0001 東京都千代田区")
    assert patterns["jp_postal_bare"].search("100-0001")
    # Must not match inside a phone number.
    assert not patterns["jp_postal_bare"].search("090-1234-5678")


PHONE_SAMPLES = {
    # language -> (matching samples, non-matching samples)
    "es": (
        [
            "Llámame al +34 612 345 678.",
            "+34612345678",
            "mi móvil es 612 345 678",
            "612-345-678",
            "el fijo es 91 234 56 78",
        ],
        # Bare 9-digit runs without separators or prefix are too ambiguous;
        # not inside longer digit runs.
        ["612345678", "9612 345 678987"],
    ),
    "vi": (
        [
            "gọi 0912 345 678 nhé",
            "091 234 5678",
            "0912345678",
            "024 3826 8888",
            "+84 912 345 678",
            "+84912345678",
        ],
        ["10912345678"],
    ),
    "zh": (
        ["手机是 138 0013 8000", "13800138000", "+86 138-0013-8000", "电话 010-12345678"],
        ["213800138000"],
    ),
    "ko": (
        ["전화는 010-1234-5678", "01012345678", "+82 10-1234-5678", "02-312-3456"],
        ["9010-1234-5678"],
    ),
    "fr": (
        ["appelez le 06 12 34 56 78", "+33 6 12 34 56 78", "0612345678"],
        ["06 12 34 56 789"],
    ),
    "de": (
        ["Telefon: 030 901820", "0171 2345678", "+49 30 901820", "0711/123456"],
        # Separator required without the +49 prefix.
        ["030901820"],
    ),
    "pt": (
        ["ligue para 912 345 678", "+351 912 345 678", "+351912345678", "212 345 678"],
        ["912345678"],
    ),
    "it": (
        ["chiamami al 333 123 4567", "+39 333 123 4567", "+39 3331234567", "06 698212"],
        ["333123456789"],
    ),
}


@pytest.mark.parametrize("language", sorted(PHONE_SAMPLES))
def test_registry_phone_regex_patterns(language: str) -> None:
    import re

    from prompt_anonymizer.languages import LANGUAGES

    spec = LANGUAGES[language].phone
    assert spec is not None
    patterns = [re.compile(p.regex) for p in spec.patterns]
    positives, negatives = PHONE_SAMPLES[language]
    for sample in positives:
        assert any(p.search(sample) for p in patterns), f"{language}: no pattern matched {sample!r}"
    for sample in negatives:
        assert not any(p.search(sample) for p in patterns), f"{language}: false match on {sample!r}"


def test_registry_phone_recognizer_scoped_to_language() -> None:
    from prompt_anonymizer.recognizers import build_phone_regex_recognizer

    recognizer = build_phone_regex_recognizer("es")
    assert recognizer is not None
    assert recognizer.supported_language == "es"
    # Languages without a registry phone spec have no scoped recognizer.
    assert build_phone_regex_recognizer("en") is None
    assert build_phone_regex_recognizer("ja") is None


def test_credit_card_regex_matches_next_to_cjk() -> None:
    import re

    from prompt_anonymizer.recognizers.credit_card import CreditCardLookaroundRecognizer

    pattern = re.compile(CreditCardLookaroundRecognizer.PATTERNS[0].regex)
    # Presidio's built-in \b anchors fail on both of these.
    assert pattern.search("カード番号は4111111111111111です")
    assert pattern.search("番号:4111-1111-1111-1111。")
    assert pattern.search("The card is 4111 1111 1111 1111.")
    # Not inside longer digit runs.
    assert not pattern.search("94111111111111111")
    # 13-digit Unix timestamps are excluded (upstream fix preserved).
    assert not pattern.search("timestamp 1748503543012 end")


def test_credit_card_luhn_validation() -> None:
    from prompt_anonymizer.recognizers.credit_card import CreditCardLookaroundRecognizer

    recognizer = CreditCardLookaroundRecognizer(supported_language="ja")
    assert recognizer.validate_result("4111111111111111") is True
    assert recognizer.validate_result("4111-1111-1111-1111") is True
    assert recognizer.validate_result("4111111111111112") is False


def test_email_address_plain_detection() -> None:
    from presidio_analyzer.predefined_recognizers import EmailRecognizer

    rec = EmailRecognizer(supported_language="en")
    results = rec.analyze(
        "Contact taro@example.com today", entities=["EMAIL_ADDRESS"], nlp_artifacts=None
    )
    assert any(
        r.entity_type == "EMAIL_ADDRESS"
        and "taro@example.com" in "Contact taro@example.com today"[r.start : r.end]
        for r in results
    )


def test_email_address_subdomain_plus_tag() -> None:
    from presidio_analyzer.predefined_recognizers import EmailRecognizer

    rec = EmailRecognizer(supported_language="en")
    results = rec.analyze(
        "Email: a.b+tag@mail.example.co.jp", entities=["EMAIL_ADDRESS"], nlp_artifacts=None
    )
    assert any(
        r.entity_type == "EMAIL_ADDRESS"
        and "a.b+tag@mail.example.co.jp" in "Email: a.b+tag@mail.example.co.jp"[r.start : r.end]
        for r in results
    )


def test_email_address_cjk_adjacent_not_detected() -> None:
    from presidio_analyzer.predefined_recognizers import EmailRecognizer

    rec = EmailRecognizer(supported_language="ja")
    results = rec.analyze(
        "メールはtaro@example.comです", entities=["EMAIL_ADDRESS"], nlp_artifacts=None
    )
    # EmailRecognizer uses \b word boundaries which fail adjacent to CJK.
    # Pinning actual behavior: no EMAIL_ADDRESS detected when email is adjacent to CJK.
    email_results = [r for r in results if r.entity_type == "EMAIL_ADDRESS"]
    assert len(email_results) == 0


def test_email_address_no_tld_not_detected() -> None:
    from presidio_analyzer.predefined_recognizers import EmailRecognizer

    rec = EmailRecognizer(supported_language="en")
    results = rec.analyze("not-an-email@nowhere", entities=["EMAIL_ADDRESS"], nlp_artifacts=None)
    # EmailRecognizer should not flag addresses without a dot-TLD as EMAIL_ADDRESS.
    # Verify the actual behavior: expect no full match of "not-an-email@nowhere".
    full_text = "not-an-email@nowhere"
    full_spans = [
        r
        for r in results
        if r.entity_type == "EMAIL_ADDRESS" and r.start == 0 and r.end == len(full_text)
    ]
    assert len(full_spans) == 0


def test_us_phone_regex_patterns() -> None:
    import re

    from prompt_anonymizer.recognizers.us_phone import UsPhoneRegexRecognizer

    patterns = {p.name: re.compile(p.regex) for p in UsPhoneRegexRecognizer.PATTERNS}
    # Positives
    assert patterns["us_phone"].search("(333) 333-3333")
    assert patterns["us_phone"].search("333-333-3333")
    assert patterns["us_phone"].search("+1 333 333 3333")
    assert patterns["us_phone"].search("333.333.3333")
    # Negatives: leading/trailing digit
    assert not patterns["us_phone"].search("1333-333-3333")
    assert not patterns["us_phone"].search("333-333-33334")


def test_deny_list_spans_multiple_occurrences() -> None:
    from prompt_anonymizer.labeling import deny_list_spans

    text = "プロジェクトXと極秘とプロジェクトX"
    spans = deny_list_spans(text, ["プロジェクトX", "極秘"])
    # Two occurrences of プロジェクトX and one of 極秘
    assert len(spans) == 3
    # All should be entity_type="CUSTOM"
    assert all(s.entity_type == "CUSTOM" for s in spans)
    # Verify correct offsets
    for span in spans:
        assert text[span.start : span.end] in ["プロジェクトX", "極秘"]


def test_deny_list_spans_empty_entry() -> None:
    from prompt_anonymizer.labeling import deny_list_spans

    # Empty string should produce no spans (skipped in deny_list_spans)
    assert deny_list_spans("テキスト", [""]) == []


def test_deny_list_spans_entity_type() -> None:
    from prompt_anonymizer.labeling import deny_list_spans

    spans = deny_list_spans("これは機密です", ["機密"])
    assert len(spans) == 1
    assert spans[0].entity_type == "CUSTOM"
    assert spans[0].score == 1.0


# Score parity table (Python vs web/packages/core recognizers.ts).
# Scores intentionally differ today; this pin makes future drift visible.
#   jp_mobile     py 0.6 / ts 0.7
#   jp_landline   py 0.5 / ts 0.6
#   jp_tollfree   py 0.6 / ts 0.7
#   us_phone      py 0.6 / ts 0.6
#   postal_marked py 0.9 / ts 0.9
#   postal_bare   py 0.3 (all langs, context-boosted) / ts 0.35 (ja only)
#   my_number     py 0.5 -> 1.0 on check-digit / ts 0.7 flat
#   credit_card   py 0.3 -> 1.0 on Luhn / ts 1.0 (pre-validated)
def test_recognizer_score_parity() -> None:
    from prompt_anonymizer.recognizers.credit_card import CreditCardLookaroundRecognizer
    from prompt_anonymizer.recognizers.ja_phone import JaPhoneRegexRecognizer
    from prompt_anonymizer.recognizers.ja_postal_code import JaPostalCodeRecognizer
    from prompt_anonymizer.recognizers.my_number import MyNumberRecognizer
    from prompt_anonymizer.recognizers.us_phone import UsPhoneRegexRecognizer

    # JP phone scores
    ja_phone_patterns = {p.name: p.score for p in JaPhoneRegexRecognizer.PATTERNS}
    assert ja_phone_patterns["jp_mobile"] == 0.6
    assert ja_phone_patterns["jp_landline"] == 0.5
    assert ja_phone_patterns["jp_tollfree"] == 0.6

    # US phone score
    us_phone_patterns = {p.name: p.score for p in UsPhoneRegexRecognizer.PATTERNS}
    assert us_phone_patterns["us_phone"] == 0.6

    # JP postal code scores
    postal_patterns = {p.name: p.score for p in JaPostalCodeRecognizer.PATTERNS}
    assert postal_patterns["jp_postal_marked"] == 0.9
    assert postal_patterns["jp_postal_bare"] == 0.3

    # My Number initial score (validate_result can lift to 1.0)
    my_number_patterns = {p.name: p.score for p in MyNumberRecognizer.PATTERNS}
    assert my_number_patterns["jp_my_number"] == 0.5

    # Credit Card initial score (validate_result lifts Luhn-valid to 1.0)
    cc_patterns = {p.name: p.score for p in CreditCardLookaroundRecognizer.PATTERNS}
    assert cc_patterns["all_credit_cards_lookaround"] == 0.3


def test_us_ssn_regex_matches_next_to_cjk() -> None:
    import re

    from prompt_anonymizer.recognizers.us_ssn import UsSsnLookaroundRecognizer

    pattern = re.compile(UsSsnLookaroundRecognizer.PATTERNS[4].regex)
    assert pattern.search("社会保障番号は123-45-6780です")
    assert pattern.search("Payroll SSN 856-45-6780 for reimbursement")
    # Not inside longer digit runs.
    assert not pattern.search("9123-45-67809")


def test_us_ssn_inherited_invalidation() -> None:
    from prompt_anonymizer.recognizers.us_ssn import UsSsnLookaroundRecognizer

    recognizer = UsSsnLookaroundRecognizer(supported_language="en")
    assert recognizer.invalidate_result("000-12-3456") is True
    assert recognizer.invalidate_result("123-45-6789") is True
    assert recognizer.invalidate_result("123.45-6789") is True
    assert recognizer.invalidate_result("856-45-6780") is False
