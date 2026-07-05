"""Anonymize PII before it reaches an LLM - with consistent, reversible labels."""

from prompt_anonymizer.core import DEFAULT_ENTITIES, PromptAnonymizer
from prompt_anonymizer.exceptions import (
    ModelNotDownloadedError,
    PromptAnonymizerError,
    UnsupportedLanguageError,
)
from prompt_anonymizer.labeling import AnonymizeResult, EntitySpan

__version__ = "0.2.0"

__all__ = [
    "DEFAULT_ENTITIES",
    "AnonymizeResult",
    "EntitySpan",
    "ModelNotDownloadedError",
    "PromptAnonymizer",
    "PromptAnonymizerError",
    "UnsupportedLanguageError",
    "__version__",
]
