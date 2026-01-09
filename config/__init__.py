"""Configuration package for Prompt Anonymizer."""
from .constants import OPENAI_MODEL, LANGUAGE_LABELS_PATH, LANGUAGES, ENTITIES
from .nlp_models import NLP_ENGINE, NLP_MODELS

__all__ = [
    "OPENAI_MODEL",
    "LANGUAGE_LABELS_PATH",
    "LANGUAGES",
    "ENTITIES",
    "NLP_ENGINE",
    "NLP_MODELS",
]
