"""Credit card recognizer usable across languages.

Presidio's built-in ``CreditCardRecognizer`` is registered for ``en`` only
and anchors its pattern with ``\\b`` word boundaries. In Unicode regex both
CJK characters and digits count as word characters, so ``\\b`` never
matches between Japanese text and a card number (``カード番号は4111...``).
This variant swaps the boundaries for the digit lookarounds already used by
the other JP recognizers, and is registered for every configured language.
Luhn validation is inherited from the built-in class.
"""

from __future__ import annotations

from collections.abc import Sequence

from presidio_analyzer import Pattern
from presidio_analyzer.predefined_recognizers import CreditCardRecognizer

# Same body as Presidio's "All Credit Cards (weak)" pattern, with the \b
# anchors replaced by lookarounds that also work adjacent to CJK text.
# Bounded quantifiers only - no ReDoS-prone nesting.
_PATTERN = Pattern(
    "all_credit_cards_lookaround",
    r"(?<![\d-])(?!1\d{12}(?!\d))"
    r"((4\d{3})|(5[0-5]\d{2})|(6\d{3})|(1\d{3})|(3\d{3}))"
    r"[- ]?(\d{3,4})[- ]?(\d{3,4})[- ]?(\d{3,5})(?![\d-])",
    0.3,
)

_JA_CONTEXT = ["クレジットカード", "カード番号", "カード", "クレカ", "支払い"]


class CreditCardLookaroundRecognizer(CreditCardRecognizer):
    """Built-in credit card recognizer with CJK-safe boundaries."""

    # Not ClassVar (mypy rejects overriding the base's plain attribute with
    # one); ruff's mutable-default warning is a false positive here.
    PATTERNS: list[Pattern] = [_PATTERN]  # noqa: RUF012

    def __init__(self, supported_language: str = "en") -> None:
        context = list(CreditCardRecognizer.CONTEXT)
        if supported_language == "ja":
            context = _JA_CONTEXT + context
        super().__init__(
            patterns=[_PATTERN],
            context=context,
            supported_language=supported_language,
            name="CreditCardLookaroundRecognizer",
        )


def build_credit_card_recognizers(
    languages: Sequence[str],
) -> list[CreditCardLookaroundRecognizer]:
    """One CJK-safe credit card recognizer per configured language."""
    return [CreditCardLookaroundRecognizer(supported_language=lang) for lang in languages]
