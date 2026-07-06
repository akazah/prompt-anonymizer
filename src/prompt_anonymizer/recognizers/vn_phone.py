"""Vietnamese phone number recognizers.

Vietnamese mobiles are ten digits starting with 0 (03x/05x/07x/08x/09x),
grouped 4-3-3 ("0912 345 678") or 3-3-4 ("091 234 5678"); landlines add an
area code (02x) for eleven digits ("024 3826 8888"). The +84 country
prefix replaces the leading 0. The regex fallback mirrors the TypeScript
core; Presidio's libphonenumber-backed ``PhoneRecognizer`` (VN region)
complements it.
"""

from __future__ import annotations

from typing import ClassVar

from presidio_analyzer import EntityRecognizer, Pattern, PatternRecognizer
from presidio_analyzer.predefined_recognizers import PhoneRecognizer

# 9 digits after the prefix (mobile), or 10 for 02x landlines. Each
# alternative is a fixed run of bounded groups - no ReDoS-prone nesting.
_VN_PHONE_BODY = (
    r"(?:\d{2}[ .-]?\d{3}[ .-]?\d{4}"
    r"|\d{3}[ .-]?\d{3}[ .-]?\d{3}"
    r"|\d{2}[ .-]?\d{4}[ .-]?\d{4})"
)


class VnPhoneRegexRecognizer(PatternRecognizer):
    """Regex fallback for Vietnamese phone notation variants."""

    PATTERNS: ClassVar[list[Pattern]] = [
        # 0912 345 678 / 091 234 5678 / 0912345678 / 024 3826 8888
        Pattern("vn_phone_domestic", rf"(?<!\d)0{_VN_PHONE_BODY}(?!\d)", 0.6),
        # +84 912 345 678 / +84912345678 (leading 0 dropped)
        Pattern("vn_phone_prefixed", rf"(?<!\d)\+84[ .-]?{_VN_PHONE_BODY}(?!\d)", 0.6),
    ]

    CONTEXT: ClassVar[list[str]] = [
        "điện thoại",
        "số điện thoại",
        "di động",
        "gọi",
        "liên hệ",
        "sđt",
        "tel",
        "phone",
    ]

    def __init__(self, supported_language: str = "vi") -> None:
        super().__init__(
            supported_entity="PHONE_NUMBER",
            patterns=self.PATTERNS,
            context=self.CONTEXT,
            supported_language=supported_language,
            name="VnPhoneRegexRecognizer",
        )


def build_vn_phone_recognizers() -> list[EntityRecognizer]:
    """Recognizers to register on the ``vi`` pipeline for PHONE_NUMBER."""
    return [
        PhoneRecognizer(
            supported_language="vi",
            supported_regions=("VN",),
            context=["điện thoại", "di động", "gọi", "liên hệ", "sđt"],
        ),
        VnPhoneRegexRecognizer(),
    ]
