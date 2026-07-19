"""GLiNER PII NER recognizers (evaluation-gated backend, docs/PLAN_INTL_PII.md P17).

Contextual PII only (PERSON / LOCATION): structured entities (emails,
phones, numbers) stay on the regex + checksum track, so the GLiNER
recognizers never receive or emit them. Model revisions are pinned per
the licensing policy in ``CONTRIBUTING.md`` — re-audit before bumping.

Requires the ``gliner`` extra: ``pip install "prompt-anonymizer[gliner]"``.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from presidio_analyzer import EntityRecognizer

__all__ = ["DEFAULT_GLINER_MODELS", "GlinerModelSpec", "build_gliner_recognizer"]


@dataclass(frozen=True)
class GlinerModelSpec:
    """One GLiNER checkpoint: revision-pinned, with its label mapping."""

    model_name: str
    #: Pinned commit hash (licensing policy: model cards can change license).
    revision: str
    #: GLiNER prompt label -> Presidio entity type.
    entity_mapping: dict[str, str]
    #: Extra kwargs for ``GLiNER.from_pretrained`` (e.g. ``max_width``).
    model_kwargs: dict[str, Any] = field(default_factory=dict)
    #: Chunk size/overlap in characters (ja model caps at 160 tokens).
    chunk_size: int = 250
    chunk_overlap: int = 50
    #: Swap in the Janome-based word splitter the ja model was trained with.
    ja_splitter: bool = False


# Apache-2.0, en/fr/de/es/it/pt (mBERT base transfers best-effort to the
# other Latin-script languages; CJK needs a dedicated fine-tune - see ja).
_MULTI_PII = GlinerModelSpec(
    model_name="urchade/gliner_multi_pii-v1",
    revision="1fcf13e85f4eef5394e1fcd406cf2ca9ea82351d",
    entity_mapping={"person": "PERSON", "address": "LOCATION", "location": "LOCATION"},
)

# Apache-2.0, ja fine-tune of the model above (Faker-synthetic training
# data). Requires the Janome splitter and max_width=25 per the model card;
# max input is 160 tokens, so chunk shorter than the default.
_JA_PII = GlinerModelSpec(
    model_name="DataSign/gliner-ja-pii-v1",
    revision="54e97b315fc6d604847c8d273e0829794260540d",
    entity_mapping={"person name": "PERSON", "address": "LOCATION"},
    model_kwargs={"max_width": 25},
    chunk_size=200,
    chunk_overlap=40,
    ja_splitter=True,
)

#: Per-language checkpoint for ``ner_backend="gliner"``.
DEFAULT_GLINER_MODELS: dict[str, GlinerModelSpec] = {"ja": _JA_PII}


def _spec_for(language: str) -> GlinerModelSpec:
    return DEFAULT_GLINER_MODELS.get(language, _MULTI_PII)


class _JanomeSplitterNoWhitespace:
    """Janome word splitter that drops whitespace-only tokens.

    The ja model was trained with this exact splitter (the model card
    mandates it); GLiNER's default whitespace splitter cannot segment
    Japanese and drops recall to near zero.
    """

    def __init__(self) -> None:
        from gliner.data_processing import WordsSplitter

        self._base = WordsSplitter(splitter_type="janome")

    def __call__(self, text: str) -> Iterator[tuple[str, int, int]]:
        for token, start, end in self._base(text):
            if token.strip() == "":
                continue
            yield token, start, end


def build_gliner_recognizer(language: str) -> EntityRecognizer:
    """Build a revision-pinned GLiNER recognizer for ``language``."""
    if not _gliner_installed():
        raise ImportError(
            'ner_backend="gliner" requires the gliner extra: '
            'pip install "prompt-anonymizer[gliner]"'
        )
    from presidio_analyzer.chunkers import CharacterBasedTextChunker
    from presidio_analyzer.predefined_recognizers import GLiNERRecognizer

    spec = _spec_for(language)

    class _PinnedGlinerRecognizer(GLiNERRecognizer):
        def load(self) -> None:
            super().load()
            if spec.ja_splitter:
                assert self.gliner is not None
                self.gliner.data_processor.words_splitter = _JanomeSplitterNoWhitespace()

        def analyze(self, text: str, entities: Any, nlp_artifacts: Any = None) -> Any:
            # The engine passes every requested entity (EMAIL_ADDRESS,
            # JP_MY_NUMBER, ...); the base class would forward unknown ones
            # to GLiNER as ad-hoc prompt labels. Structured PII stays on
            # the regex track, so keep this recognizer to its own scope.
            scoped = [e for e in entities if e in self.supported_entities]
            return super().analyze(text, scoped, nlp_artifacts)

    return _PinnedGlinerRecognizer(
        entity_mapping=spec.entity_mapping,
        model_name=spec.model_name,
        supported_language=language,
        text_chunker=CharacterBasedTextChunker(
            chunk_size=spec.chunk_size, chunk_overlap=spec.chunk_overlap
        ),
        revision=spec.revision,
        **spec.model_kwargs,
    )


def _gliner_installed() -> bool:
    import importlib.util

    return importlib.util.find_spec("gliner") is not None
