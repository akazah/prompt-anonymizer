"""Japanese postal code recognizer (e.g. 〒100-0001)."""

from __future__ import annotations

from typing import ClassVar

from presidio_analyzer import Pattern, PatternRecognizer


class JaPostalCodeRecognizer(PatternRecognizer):
    """Detects Japanese postal codes.

    A leading 〒 mark is a strong signal on its own; a bare NNN-NNNN needs
    context words (住所, 宛先, ...) to be boosted above the score threshold.
    """

    PATTERNS: ClassVar[list[Pattern]] = [
        Pattern("jp_postal_marked", r"〒\s?\d{3}-?\d{4}", 0.9),
        Pattern("jp_postal_bare", r"(?<![\d-])\d{3}-\d{4}(?![\d-])", 0.3),
    ]

    # Context matching compares whole lemmas; spaCy ja (Sudachi mode A)
    # splits 郵便番号 into 郵便/番号, so the short unit 郵便 must be listed
    # for the compound to count as context.
    CONTEXT: ClassVar[list[str]] = [
        "郵便番号",
        "郵便",
        "住所",
        "宛先",
        "所在地",
        "〒",
        "postal",
        "zip",
    ]

    def __init__(self, supported_language: str = "ja") -> None:
        super().__init__(
            supported_entity="JP_POSTAL_CODE",
            patterns=self.PATTERNS,
            context=self.CONTEXT,
            supported_language=supported_language,
            name="JaPostalCodeRecognizer",
        )
