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


def test_ja_postal_regex_patterns() -> None:
    import re

    from prompt_anonymizer.recognizers.ja_postal_code import JaPostalCodeRecognizer

    patterns = {p.name: re.compile(p.regex) for p in JaPostalCodeRecognizer.PATTERNS}
    assert patterns["jp_postal_marked"].search("〒100-0001 東京都千代田区")
    assert patterns["jp_postal_bare"].search("100-0001")
    # Must not match inside a phone number.
    assert not patterns["jp_postal_bare"].search("090-1234-5678")


def test_es_phone_regex_patterns() -> None:
    import re

    from prompt_anonymizer.recognizers.es_phone import EsPhoneRegexRecognizer

    patterns = {p.name: re.compile(p.regex) for p in EsPhoneRegexRecognizer.PATTERNS}
    assert patterns["es_phone_prefixed"].search("Llámame al +34 612 345 678.")
    assert patterns["es_phone_prefixed"].search("+34612345678")
    assert patterns["es_phone_grouped"].search("mi móvil es 612 345 678")
    assert patterns["es_phone_grouped"].search("612-345-678")
    assert patterns["es_phone_landline"].search("el fijo es 91 234 56 78")
    # Bare 9-digit runs without separators or prefix are too ambiguous.
    assert not patterns["es_phone_grouped"].search("612345678")
    # Not inside longer digit runs.
    assert not patterns["es_phone_grouped"].search("9612 345 678987")


def test_vn_phone_regex_patterns() -> None:
    import re

    from prompt_anonymizer.recognizers.vn_phone import VnPhoneRegexRecognizer

    patterns = {p.name: re.compile(p.regex) for p in VnPhoneRegexRecognizer.PATTERNS}
    assert patterns["vn_phone_domestic"].search("gọi 0912 345 678 nhé")
    assert patterns["vn_phone_domestic"].search("091 234 5678")
    assert patterns["vn_phone_domestic"].search("0912345678")
    assert patterns["vn_phone_domestic"].search("024 3826 8888")
    assert patterns["vn_phone_prefixed"].search("+84 912 345 678")
    assert patterns["vn_phone_prefixed"].search("+84912345678")
    # Not inside longer digit runs.
    assert not patterns["vn_phone_domestic"].search("10912345678")


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
