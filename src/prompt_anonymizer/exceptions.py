"""Exceptions raised by prompt-anonymizer."""

from __future__ import annotations


class PromptAnonymizerError(Exception):
    """Base class for all prompt-anonymizer errors."""


class ModelNotDownloadedError(PromptAnonymizerError):
    """Raised when a required spaCy language model is not installed."""

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        super().__init__(
            f"spaCy model '{model_name}' is not installed. "
            f"Download it with:\n\n    python -m spacy download {model_name}\n"
        )


class UnsupportedLanguageError(PromptAnonymizerError):
    """Raised when anonymize() is called with a language not configured."""

    def __init__(self, language: str, supported: list[str]) -> None:
        self.language = language
        self.supported = supported
        super().__init__(
            f"Language '{language}' is not configured. Supported languages: {', '.join(supported)}"
        )
