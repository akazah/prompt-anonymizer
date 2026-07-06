"""Spanish phone number recognizers.

Spanish numbers are nine digits (mobiles start with 6/7, landlines with
8/9) conventionally grouped 3-3-3 ("612 345 678") or, for landlines,
2-3-2-2 ("91 234 56 78"). A bare 9-digit run is too ambiguous, so the
regex fallback requires either the +34 country prefix or group separators
- mirroring the TypeScript core. Presidio's libphonenumber-backed
``PhoneRecognizer`` (ES region) complements it for other notations.
"""

from __future__ import annotations

from typing import ClassVar

from presidio_analyzer import EntityRecognizer, Pattern, PatternRecognizer
from presidio_analyzer.predefined_recognizers import PhoneRecognizer


class EsPhoneRegexRecognizer(PatternRecognizer):
    """Regex fallback for Spanish phone notation variants."""

    PATTERNS: ClassVar[list[Pattern]] = [
        # +34 612 345 678 / +34612345678 (separators optional with prefix)
        Pattern(
            "es_phone_prefixed",
            r"(?<!\d)\+34[ .-]?[6789]\d{2}[ .-]?\d{3}[ .-]?\d{3}(?!\d)",
            0.6,
        ),
        # 612 345 678 / 612-345-678 (separators required without prefix)
        Pattern(
            "es_phone_grouped",
            r"(?<!\d)[6789]\d{2}[ .-]\d{3}[ .-]\d{3}(?!\d)",
            0.6,
        ),
        # Landline 2-3-2-2 grouping: 91 234 56 78
        Pattern(
            "es_phone_landline",
            r"(?<!\d)[89]\d[ .-]\d{3}[ .-]\d{2}[ .-]\d{2}(?!\d)",
            0.5,
        ),
    ]

    CONTEXT: ClassVar[list[str]] = [
        "teléfono",
        "telefono",
        "móvil",
        "movil",
        "llamar",
        "contacto",
        "tel",
        "phone",
    ]

    def __init__(self, supported_language: str = "es") -> None:
        super().__init__(
            supported_entity="PHONE_NUMBER",
            patterns=self.PATTERNS,
            context=self.CONTEXT,
            supported_language=supported_language,
            name="EsPhoneRegexRecognizer",
        )


def build_es_phone_recognizers() -> list[EntityRecognizer]:
    """Recognizers to register on the ``es`` pipeline for PHONE_NUMBER."""
    return [
        PhoneRecognizer(
            supported_language="es",
            supported_regions=("ES",),
            context=["teléfono", "móvil", "llamar", "contacto", "tel"],
        ),
        EsPhoneRegexRecognizer(),
    ]
