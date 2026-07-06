"""Structured-PII scan that needs no NLP engine or language models.

Backs the ``prompt-anonymizer scan`` CLI command, the commit-time gate
(``.pre-commit-hooks.yaml``) and CI checks. It runs only the pattern-based
recognizers (email, phone, postal code, My Number, credit card) plus the
deny list, so it is fast, deterministic and works offline without spaCy
models - the right trade-off for a pre-commit hook. NER-detected entities
(PERSON, LOCATION) are NOT covered here; use
:meth:`~prompt_anonymizer.core.PromptAnonymizer.anonymize` (CLI:
``scan --ner``) for those.

Mirrors ``detectWithRegex`` + ``detectDenyList`` in the TypeScript core
(``web/packages/core/src/recognizers.ts``).
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from typing import TYPE_CHECKING

from prompt_anonymizer.labeling import EntitySpan, deny_list_spans, merge_spans

if TYPE_CHECKING:
    from presidio_analyzer import EntityRecognizer

#: Entity types the engine-free scan can detect (pattern recognizers only).
STRUCTURED_ENTITIES = [
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "JP_POSTAL_CODE",
    "JP_MY_NUMBER",
    "CREDIT_CARD",
]

DEFAULT_SCORE_THRESHOLD = 0.4

_JA_SCRIPT = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]")
_VI_MARKERS = re.compile(r"[ăâđơưĂÂĐƠƯ\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]")
_ES_MARKERS = re.compile(r"[¿¡ñÑáéíóúüÁÉÍÓÚÜ]")

_recognizers: dict[str, list[EntityRecognizer]] = {}


def guess_language(text: str) -> str:
    """Heuristic language guess from script ranges and marker letters.

    Ordering: kana/kanji → ``ja``; Vietnamese-specific letters → ``vi``;
    Spanish markers → ``es``; otherwise ``en``. Mirrors ``guessLanguage``
    in the TypeScript core (``web/packages/core/src/language-detect.ts``).
    """
    if _JA_SCRIPT.search(text):
        return "ja"
    if _VI_MARKERS.search(text):
        return "vi"
    if _ES_MARKERS.search(text):
        return "es"
    return "en"


def _structured_recognizers(language: str = "en") -> list[EntityRecognizer]:
    """Pattern recognizers usable without an NLP engine (built once per language).

    ``supported_language`` is only consulted by the analyzer registry, not
    by direct ``analyze()`` calls, so one language-agnostic base list covers
    en and ja - like the TypeScript core's regex rule table. The es / vi
    phone patterns are language-scoped (mirroring the TS rules' ``languages``
    field) because e.g. a Vietnamese ``0912 345 678`` must not fire on en text.
    """
    if language not in _recognizers:
        from presidio_analyzer.predefined_recognizers import EmailRecognizer, PhoneRecognizer

        from prompt_anonymizer.recognizers import (
            CreditCardLookaroundRecognizer,
            EsPhoneRegexRecognizer,
            JaPhoneRegexRecognizer,
            JaPostalCodeRecognizer,
            MyNumberRecognizer,
            UsPhoneRegexRecognizer,
            VnPhoneRegexRecognizer,
        )

        recognizers: list[EntityRecognizer] = [
            EmailRecognizer(),
            PhoneRecognizer(supported_regions=("JP", "US")),
            JaPhoneRegexRecognizer(),
            UsPhoneRegexRecognizer(),
            JaPostalCodeRecognizer(),
            MyNumberRecognizer(),
            CreditCardLookaroundRecognizer(),
        ]
        if language == "es":
            recognizers.append(EsPhoneRegexRecognizer())
        elif language == "vi":
            recognizers.append(VnPhoneRegexRecognizer())
        _recognizers[language] = recognizers
    return _recognizers[language]


def detect_structured(text: str, language: str = "auto") -> list[EntitySpan]:
    """Detect structured PII with pattern recognizers only (no NLP engine).

    ``language`` selects the language-scoped patterns (es / vi phones);
    ``"auto"`` uses :func:`guess_language`. Returns raw, unmerged spans;
    scores below recognizer context boosts (which require the full engine)
    are reported as-is.
    """
    if language == "auto":
        language = guess_language(text)
    spans: list[EntitySpan] = []
    for recognizer in _structured_recognizers(language):
        # Pattern-based recognizers never read nlp_artifacts; the base
        # class annotates it as required, hence the ignore.
        results = recognizer.analyze(
            text,
            entities=list(STRUCTURED_ENTITIES),
            nlp_artifacts=None,  # type: ignore[arg-type]
        )
        for result in results:
            spans.append(
                EntitySpan(
                    start=result.start,
                    end=result.end,
                    entity_type=result.entity_type,
                    score=result.score,
                )
            )
    return spans


def scan_text(
    text: str,
    deny_list: Sequence[str] = (),
    allow_list: Sequence[str] = (),
    score_threshold: float = DEFAULT_SCORE_THRESHOLD,
    language: str = "auto",
) -> list[EntitySpan]:
    """Scan ``text`` for structured PII and deny-listed terms.

    Engine-free counterpart of :meth:`PromptAnonymizer.anonymize` for
    commit-time / CI gates: same span merging and allow-list semantics,
    but detection is limited to :data:`STRUCTURED_ENTITIES` and ``CUSTOM``
    (deny list). Returns merged spans sorted by start offset; an empty
    list means the text is clean.
    """
    spans = [
        span
        for span in detect_structured(text, language=language)
        if span.score >= score_threshold and text[span.start : span.end] not in allow_list
    ]
    spans.extend(deny_list_spans(text, deny_list))
    return merge_spans(spans, text)
