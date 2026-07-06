"""Anonymize / deanonymize core built on Presidio + spaCy."""

from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING

from prompt_anonymizer import labeling
from prompt_anonymizer.exceptions import ModelNotDownloadedError, UnsupportedLanguageError
from prompt_anonymizer.labeling import AnonymizeResult, EntitySpan

if TYPE_CHECKING:
    from presidio_analyzer import AnalyzerEngine, BatchAnalyzerEngine, RecognizerResult

DEFAULT_ENTITIES = [
    "PERSON",
    "EMAIL_ADDRESS",
    "LOCATION",
    "PHONE_NUMBER",
    "JP_POSTAL_CODE",
    "JP_MY_NUMBER",
    "CREDIT_CARD",
]

# Opt-in entity types — pass via ``entities=`` on :class:`PromptAnonymizer`.
OPTIONAL_ENTITIES = ["US_SSN", "IBAN_CODE"]

_SPACY_MODELS = {
    "sm": {"en": "en_core_web_sm", "ja": "ja_core_news_sm"},
    "lg": {"en": "en_core_web_lg", "ja": "ja_core_news_lg"},
}

_NER_BACKENDS = ("spacy", "hf")

# Same model family as the TypeScript core (web/packages/core/src/ner.ts),
# which runs ONNX exports of these models via transformers.js. Using the
# original checkpoints here keeps NER behaviour aligned across both cores.
DEFAULT_HF_NER_MODELS = {
    "ja": "tsmatz/xlm-roberta-ner-japanese",
    "en": "dslim/bert-base-NER",
}

# Mirror of the TS core's TAG_MAP (web/packages/core/src/ner.ts). Tags not
# listed here (ORG, PRD, ...) are filtered out by the engine-level entity
# filter in ``AnalyzerEngine.analyze``.
_HF_LABEL_MAPPING = {
    "PER": "PERSON",
    "PERSON": "PERSON",
    "LOC": "LOCATION",
    "LOCATION": "LOCATION",
    "GPE": "LOCATION",
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
        ner_backend: ``"spacy"`` (default) uses the spaCy model's NER for
            PERSON / LOCATION. ``"hf"`` additionally runs a transformer NER
            model (requires the ``hf`` extra: ``pip install
            "prompt-anonymizer[hf]"``) for markedly better ja PERSON recall.
            Defaults mirror the TypeScript core's models
            (:data:`DEFAULT_HF_NER_MODELS`).
        hf_models: Override the per-language transformer models used when
            ``ner_backend="hf"``.
    """

    def __init__(
        self,
        languages: Sequence[str] = ("en", "ja"),
        model_size: str = "sm",
        entities: Sequence[str] | None = None,
        deny_list: Sequence[str] | None = None,
        allow_list: Sequence[str] | None = None,
        score_threshold: float = 0.4,
        ner_backend: str = "spacy",
        hf_models: dict[str, str] | None = None,
    ) -> None:
        if model_size not in _SPACY_MODELS:
            raise ValueError(f"model_size must be one of {sorted(_SPACY_MODELS)}")
        if ner_backend not in _NER_BACKENDS:
            raise ValueError(f"ner_backend must be one of {sorted(_NER_BACKENDS)}")
        self.languages = list(languages)
        self.model_size = model_size
        self.entities = list(entities) if entities is not None else list(DEFAULT_ENTITIES)
        self.deny_list = list(deny_list) if deny_list else []
        self.allow_list = list(allow_list) if allow_list else []
        self.score_threshold = score_threshold
        self.ner_backend = ner_backend
        self.hf_models = {**DEFAULT_HF_NER_MODELS, **(hf_models or {})}
        self._labels: dict[str, dict[str, str]] = {}
        self._analyzer: AnalyzerEngine | None = None
        self._batch_analyzer: BatchAnalyzerEngine | None = None

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
            UsPhoneRegexRecognizer,
            build_credit_card_recognizers,
            build_ja_phone_recognizers,
            build_us_ssn_recognizers,
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
        from presidio_analyzer.context_aware_enhancers import LemmaContextAwareEnhancer

        analyzer = AnalyzerEngine(
            nlp_engine=provider.create_engine(),
            supported_languages=self.languages,
            # Presidio's default "substring" mode can false-boost when a
            # context word appears inside an unrelated token (e.g. "TEL"
            # in "hotel"). Golden-set metrics are identical in both modes
            # for ja and en, so prefer the strict one.
            context_aware_enhancer=LemmaContextAwareEnhancer(context_matching_mode="whole_word"),
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
            # libphonenumber (PhoneRecognizer) rejects well-formed numbers
            # with unassigned area codes; keep a regex fallback in parity
            # with the TS core.
            analyzer.registry.add_recognizer(UsPhoneRegexRecognizer(supported_language=language))

        # Presidio's built-in CreditCardRecognizer is registered for ``en``
        # only and its \b anchors never match next to CJK text. Replace it
        # with a CJK-safe variant covering every configured language,
        # mirroring the TS core.
        analyzer.registry.remove_recognizer("CreditCardRecognizer")
        for recognizer in build_credit_card_recognizers(self.languages):
            analyzer.registry.add_recognizer(recognizer)

        # Presidio's built-in UsSsnRecognizer is registered for ``en`` only
        # and its \b anchors never match next to CJK text. Replace it with a
        # CJK-safe variant covering every configured language.
        # IBAN_CODE is available opt-in via Presidio's built-in IbanRecognizer
        # (already registered for all languages, mod-97 validated).
        analyzer.registry.remove_recognizer("UsSsnRecognizer")
        for recognizer in build_us_ssn_recognizers(self.languages):
            analyzer.registry.add_recognizer(recognizer)

        if self.ner_backend == "hf":
            self._add_hf_ner(analyzer)
        return analyzer

    def _add_hf_ner(self, analyzer: AnalyzerEngine) -> None:
        """Add a transformer NER recognizer on top of spaCy's.

        Union (rather than replacement) measured best on the golden set:
        the transformer is far stronger on ja PERSON (0.82 -> 1.00 recall,
        sm model) while spaCy still catches long-form JP addresses the
        transformer misses. For an anonymizer, over-masking beats leaking.
        The models are the same family the TypeScript core runs via
        transformers.js, keeping cross-core NER behaviour aligned.
        """
        try:
            from presidio_analyzer.predefined_recognizers import HuggingFaceNerRecognizer
        except ImportError as exc:  # pragma: no cover - depends on extras
            raise ImportError(
                'ner_backend="hf" requires the hf extra: pip install "prompt-anonymizer[hf]"'
            ) from exc

        for language in self.languages:
            analyzer.registry.add_recognizer(
                HuggingFaceNerRecognizer(
                    model_name=self.hf_models.get(language, DEFAULT_HF_NER_MODELS["en"]),
                    supported_language=language,
                    label_mapping=_HF_LABEL_MAPPING,
                )
            )

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

    @property
    def batch_analyzer(self) -> BatchAnalyzerEngine:
        if self._batch_analyzer is None:
            from presidio_analyzer import BatchAnalyzerEngine

            self._batch_analyzer = BatchAnalyzerEngine(analyzer_engine=self.analyzer)
        return self._batch_analyzer

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
        return self._finalize(text, results, language)

    def anonymize_batch(
        self,
        texts: Sequence[str],
        language: str = "en",
        batch_size: int = 8,
        n_process: int = 1,
    ) -> list[AnonymizeResult]:
        """Anonymize many texts at once.

        Runs the NLP pipeline through Presidio's :class:`BatchAnalyzerEngine`
        (spaCy ``nlp.pipe`` under the hood), which is considerably faster
        than calling :meth:`anonymize` in a loop. Each text is labelled
        independently: label numbering and mappings do NOT carry over
        between texts.
        """
        if language not in self.languages:
            raise UnsupportedLanguageError(language, self.languages)

        results_per_text = self.batch_analyzer.analyze_iterator(
            texts=list(texts),
            language=language,
            batch_size=batch_size,
            n_process=n_process,
            entities=list(self.entities),
            allow_list=self.allow_list or None,
            score_threshold=self.score_threshold,
        )
        return [
            self._finalize(text, results, language)
            for text, results in zip(texts, results_per_text, strict=True)
        ]

    def _finalize(
        self, text: str, results: Sequence[RecognizerResult], language: str
    ) -> AnonymizeResult:
        # Some recognizers (e.g. Presidio's HuggingFaceNerRecognizer) pass
        # through entity types outside the requested list as "discovery"
        # results; keep the output limited to what was asked for.
        requested = set(self.entities)
        spans = [
            EntitySpan(start=r.start, end=r.end, entity_type=r.entity_type, score=r.score)
            for r in results
            if r.entity_type in requested
        ]
        spans.extend(self._deny_list_spans(text))
        labels = self._labels_for(language)
        anonymized, mapping = labeling.apply_labels(text, spans, labels)
        return AnonymizeResult(
            text=anonymized, mapping=mapping, entities=labeling.merge_spans(spans, text)
        )

    @staticmethod
    def deanonymize(text: str, mapping: dict[str, str]) -> str:
        """Restore original values using the mapping from :meth:`anonymize`."""
        return labeling.deanonymize(text, mapping)
