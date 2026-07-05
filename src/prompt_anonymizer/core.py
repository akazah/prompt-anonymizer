"""Anonymize / deanonymize core built on Presidio + spaCy."""

from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING

from prompt_anonymizer import labeling
from prompt_anonymizer.exceptions import ModelNotDownloadedError, UnsupportedLanguageError
from prompt_anonymizer.labeling import AnonymizeResult, EntitySpan

if TYPE_CHECKING:
    from presidio_analyzer import AnalyzerEngine

DEFAULT_ENTITIES = [
    "PERSON",
    "EMAIL_ADDRESS",
    "LOCATION",
    "PHONE_NUMBER",
    "JP_POSTAL_CODE",
    "JP_MY_NUMBER",
    "CREDIT_CARD",
]

_SPACY_MODELS = {
    "sm": {"en": "en_core_web_sm", "ja": "ja_core_news_sm"},
    "lg": {"en": "en_core_web_lg", "ja": "ja_core_news_lg"},
}


class PromptAnonymizer:
    """Anonymize PII with consistent, reversible labels.

    Example:
        >>> pa = PromptAnonymizer(languages=["ja"])
        >>> result = pa.anonymize("山田太郎の電話は090-1234-5678", language="ja")
        >>> result.text
        '<人名_1>の電話は<電話番号_1>'
        >>> pa.deanonymize(result.text, result.mapping)
        '山田太郎の電話は090-1234-5678'

    Args:
        languages: Languages to load spaCy pipelines for.
        model_size: ``"sm"`` (fast, default) or ``"lg"`` (more accurate).
        entities: Entity types to detect. Defaults to :data:`DEFAULT_ENTITIES`.
        deny_list: Strings to always mask (labelled ``CUSTOM``).
        allow_list: Strings to never mask even when detected.
        score_threshold: Minimum recognizer confidence to accept a span.
    """

    def __init__(
        self,
        languages: Sequence[str] = ("en", "ja"),
        model_size: str = "sm",
        entities: Sequence[str] | None = None,
        deny_list: Sequence[str] | None = None,
        allow_list: Sequence[str] | None = None,
        score_threshold: float = 0.4,
    ) -> None:
        if model_size not in _SPACY_MODELS:
            raise ValueError(f"model_size must be one of {sorted(_SPACY_MODELS)}")
        self.languages = list(languages)
        self.model_size = model_size
        self.entities = list(entities) if entities is not None else list(DEFAULT_ENTITIES)
        self.deny_list = list(deny_list) if deny_list else []
        self.allow_list = list(allow_list) if allow_list else []
        self.score_threshold = score_threshold
        self._labels: dict[str, dict[str, str]] = {}
        self._analyzer: AnalyzerEngine | None = None

    # -- engine ---------------------------------------------------------

    def _model_name(self, language: str) -> str:
        return _SPACY_MODELS[self.model_size].get(language, f"{language}_core_news_sm")

    def _ensure_models(self) -> None:
        import spacy.util

        for language in self.languages:
            model = self._model_name(language)
            if not spacy.util.is_package(model):
                raise ModelNotDownloadedError(model)

    def _build_analyzer(self) -> AnalyzerEngine:
        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine import NlpEngineProvider

        from prompt_anonymizer.recognizers import (
            JaPostalCodeRecognizer,
            MyNumberRecognizer,
            build_ja_phone_recognizers,
        )

        self._ensure_models()
        provider = NlpEngineProvider(
            nlp_configuration={
                "nlp_engine_name": "spacy",
                "models": [
                    {"lang_code": lang, "model_name": self._model_name(lang)}
                    for lang in self.languages
                ],
            }
        )
        analyzer = AnalyzerEngine(
            nlp_engine=provider.create_engine(),
            supported_languages=self.languages,
        )

        if "ja" in self.languages:
            for recognizer in build_ja_phone_recognizers():
                analyzer.registry.add_recognizer(recognizer)
            analyzer.registry.add_recognizer(JaPostalCodeRecognizer())
            analyzer.registry.add_recognizer(MyNumberRecognizer())

        for language in self.languages:
            if language != "ja":
                analyzer.registry.add_recognizer(
                    JaPostalCodeRecognizer(supported_language=language)
                )
                analyzer.registry.add_recognizer(MyNumberRecognizer(supported_language=language))
        return analyzer

    def _deny_list_spans(self, text: str) -> list[EntitySpan]:
        """Substring search for deny-listed terms.

        Presidio's deny_list uses ``\\b`` word boundaries, which never match
        between Japanese characters, so we match plain substrings instead.
        """
        spans: list[EntitySpan] = []
        for needle in self.deny_list:
            if not needle:
                continue
            start = text.find(needle)
            while start != -1:
                spans.append(
                    EntitySpan(
                        start=start, end=start + len(needle), entity_type="CUSTOM", score=1.0
                    )
                )
                start = text.find(needle, start + len(needle))
        return spans

    @property
    def analyzer(self) -> AnalyzerEngine:
        if self._analyzer is None:
            self._analyzer = self._build_analyzer()
        return self._analyzer

    def _labels_for(self, language: str) -> dict[str, str]:
        if language not in self._labels:
            self._labels[language] = labeling.load_labels(language)
        return self._labels[language]

    # -- public API -------------------------------------------------------

    def anonymize(self, text: str, language: str = "en") -> AnonymizeResult:
        """Detect PII in ``text`` and replace it with consistent labels.

        Returns an :class:`AnonymizeResult` whose ``mapping`` allows the
        original values to be restored with :meth:`deanonymize`. The mapping
        is never persisted by this library; storing it safely is the
        caller's responsibility.
        """
        if language not in self.languages:
            raise UnsupportedLanguageError(language, self.languages)

        results = self.analyzer.analyze(
            text=text,
            language=language,
            entities=list(self.entities),
            allow_list=self.allow_list or None,
            score_threshold=self.score_threshold,
        )
        spans = [
            EntitySpan(start=r.start, end=r.end, entity_type=r.entity_type, score=r.score)
            for r in results
        ]
        spans.extend(self._deny_list_spans(text))
        labels = self._labels_for(language)
        anonymized, mapping = labeling.apply_labels(text, spans, labels)
        return AnonymizeResult(
            text=anonymized, mapping=mapping, entities=labeling.merge_spans(spans)
        )

    @staticmethod
    def deanonymize(text: str, mapping: dict[str, str]) -> str:
        """Restore original values using the mapping from :meth:`anonymize`."""
        return labeling.deanonymize(text, mapping)
