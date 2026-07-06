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
