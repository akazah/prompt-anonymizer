"""US/NANP phone number regex fallback.

Presidio's built-in ``PhoneRecognizer`` validates against libphonenumber,
which rejects syntactically well-formed numbers with unassigned area codes
- exactly what synthetic and anonymized-by-hand documents contain. The
TypeScript core has always carried this regex fallback
(``web/packages/core/src/recognizers.ts``); this mirrors it.
"""

from __future__ import annotations

from typing import ClassVar

from presidio_analyzer import Pattern, PatternRecognizer


class UsPhoneRegexRecognizer(PatternRecognizer):
    """Regex fallback for US phone formats: (333) 333-3333 / 333-333-3333 / +1 333 333 3333."""

    PATTERNS: ClassVar[list[Pattern]] = [
        Pattern(
            "us_phone",
            r"(?<!\d)(?:\+1[ .-]?)?(?:\(\d{3}\)[ .-]?|\d{3}[ .-])\d{3}[ .-]\d{4}(?!\d)",
            0.6,
        ),
    ]

    CONTEXT: ClassVar[list[str]] = ["phone", "call", "mobile", "tel", "line", "電話", "連絡先"]

    def __init__(self, supported_language: str = "en") -> None:
        super().__init__(
            supported_entity="PHONE_NUMBER",
            patterns=self.PATTERNS,
            context=self.CONTEXT,
            supported_language=supported_language,
            name="UsPhoneRegexRecognizer",
        )
