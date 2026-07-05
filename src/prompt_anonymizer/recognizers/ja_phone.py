"""Japanese phone number recognizers.

Presidio's built-in ``PhoneRecognizer`` defaults to ``supported_language="en"``
and does not include the JP region, so Japanese pipelines historically missed
phone numbers entirely. We register a JP-region ``PhoneRecognizer`` plus a
regex fallback for notation variants that the libphonenumber matcher skips in
Japanese prose (no surrounding whitespace, full-width context, etc.).
"""

from __future__ import annotations

from typing import ClassVar

from presidio_analyzer import EntityRecognizer, Pattern, PatternRecognizer
from presidio_analyzer.predefined_recognizers import PhoneRecognizer


class JaPhoneRegexRecognizer(PatternRecognizer):
    """Regex fallback for Japanese phone notation variants."""

    PATTERNS: ClassVar[list[Pattern]] = [
        # Mobile: 090-1234-5678 / 09012345678 / 090(1234)5678
        Pattern("jp_mobile", r"(?<!\d)0[789]0[-( ]?\d{4}[-) ]?\d{4}(?!\d)", 0.6),
        # Landline: 03-1234-5678 / 011-234-5678 / 0123-45-6789
        Pattern(
            "jp_landline",
            r"(?<!\d)0\d{1,4}[-(]\d{1,4}[-)]\d{4}(?!\d)",
            0.5,
        ),
        # Toll-free: 0120-123-456
        Pattern("jp_tollfree", r"(?<!\d)0120[- ]?\d{3}[- ]?\d{3}(?!\d)", 0.6),
    ]

    CONTEXT: ClassVar[list[str]] = [
        "電話",
        "電話番号",
        "携帯",
        "TEL",
        "Tel",
        "連絡先",
        "phone",
        "mobile",
    ]

    def __init__(self, supported_language: str = "ja") -> None:
        super().__init__(
            supported_entity="PHONE_NUMBER",
            patterns=self.PATTERNS,
            context=self.CONTEXT,
            supported_language=supported_language,
            name="JaPhoneRegexRecognizer",
        )


def build_ja_phone_recognizers() -> list[EntityRecognizer]:
    """Recognizers to register on the ``ja`` pipeline for PHONE_NUMBER."""
    return [
        PhoneRecognizer(
            supported_language="ja",
            supported_regions=("JP",),
            context=["電話", "電話番号", "携帯", "TEL", "連絡先"],
        ),
        JaPhoneRegexRecognizer(),
    ]
