"""Japanese My Number (individual number) recognizer with check-digit validation."""

from __future__ import annotations

from typing import ClassVar

from presidio_analyzer import Pattern, PatternRecognizer


def my_number_check_digit(digits: str) -> int:
    """Compute the check digit for the first 11 digits of a My Number.

    Defined by MIC ordinance: with P(n) the n-th digit counted from the
    right of the 11-digit body and Q(n) = n + 1 for n <= 6, n - 5 for n >= 7,
    the check digit is 11 - (sum(P*Q) mod 11), or 0 when the remainder <= 1.
    """
    if len(digits) != 11 or not digits.isdigit():
        raise ValueError("expected 11 digits")
    total = 0
    for n in range(1, 12):
        p = int(digits[11 - n])
        q = n + 1 if n <= 6 else n - 5
        total += p * q
    remainder = total % 11
    return 0 if remainder <= 1 else 11 - remainder


def is_valid_my_number(candidate: str) -> bool:
    """Validate a 12-digit My Number including its check digit."""
    normalized = candidate.replace("-", "").replace(" ", "")
    if len(normalized) != 12 or not normalized.isdigit():
        return False
    return my_number_check_digit(normalized[:11]) == int(normalized[11])


class MyNumberRecognizer(PatternRecognizer):
    """Detects 12-digit My Numbers and rejects candidates failing the check digit."""

    PATTERNS: ClassVar[list[Pattern]] = [
        Pattern("jp_my_number", r"(?<![\d-])\d{4}[- ]?\d{4}[- ]?\d{4}(?![\d-])", 0.5),
    ]

    CONTEXT: ClassVar[list[str]] = ["マイナンバー", "個人番号", "my number", "individual number"]

    def __init__(self, supported_language: str = "ja") -> None:
        super().__init__(
            supported_entity="JP_MY_NUMBER",
            patterns=self.PATTERNS,
            context=self.CONTEXT,
            supported_language=supported_language,
            name="MyNumberRecognizer",
        )

    def validate_result(self, pattern_text: str) -> bool:
        return is_valid_my_number(pattern_text)
