"""US Social Security Number recognizer usable across languages.

Presidio's built-in ``UsSsnRecognizer`` is registered for ``en`` only
and anchors its patterns with ``\\b`` word boundaries. In Unicode regex both
CJK characters and digits count as word characters, so ``\\b`` never
matches between Japanese text and an SSN (``社会保障番号は123-45-6780``).
This variant swaps the boundaries for digit lookarounds already used by
the other JP recognizers, and is registered for every configured language.
Invalidation (known samples, zero groups, mismatched delimiters) is
inherited from the built-in class.
"""

from __future__ import annotations

from collections.abc import Sequence

from presidio_analyzer import Pattern
from presidio_analyzer.predefined_recognizers import UsSsnRecognizer

_PATTERNS: list[Pattern] = [
    Pattern(
        "SSN1 (very weak) lookaround",
        r"(?<![\d.-])([0-9]{5})-([0-9]{4})(?![\d.-])",
        0.05,
    ),
    Pattern(
        "SSN2 (very weak) lookaround",
        r"(?<![\d.-])([0-9]{3})-([0-9]{6})(?![\d.-])",
        0.05,
    ),
    Pattern(
        "SSN3 (very weak) lookaround",
        r"(?<![\d.-])(([0-9]{3})-([0-9]{2})-([0-9]{4}))(?![\d.-])",
        0.05,
    ),
    Pattern(
        "SSN4 (very weak) lookaround",
        r"(?<![\d.-])[0-9]{9}(?![\d.-])",
        0.05,
    ),
    Pattern(
        "SSN5 (medium) lookaround",
        r"(?<![\d.-])([0-9]{3})[- .]([0-9]{2})[- .]([0-9]{4})(?![\d.-])",
        0.5,
    ),
]

_JA_CONTEXT = ["社会保障番号", "ソーシャルセキュリティ", "ssn"]


class UsSsnLookaroundRecognizer(UsSsnRecognizer):
    """Built-in US SSN recognizer with CJK-safe boundaries."""

    # Not ClassVar (mypy rejects overriding the base's plain attribute with
    # one); ruff's mutable-default warning is a false positive here.
    PATTERNS: list[Pattern] = _PATTERNS

    def __init__(self, supported_language: str = "en") -> None:
        context = list(UsSsnRecognizer.CONTEXT)
        if supported_language == "ja":
            context = _JA_CONTEXT + context
        super().__init__(
            patterns=_PATTERNS,
            context=context,
            supported_language=supported_language,
            name="UsSsnLookaroundRecognizer",
        )


def build_us_ssn_recognizers(
    languages: Sequence[str],
) -> list[UsSsnLookaroundRecognizer]:
    """One CJK-safe US SSN recognizer per configured language."""
    return [UsSsnLookaroundRecognizer(supported_language=lang) for lang in languages]
