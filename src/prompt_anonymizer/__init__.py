"""Anonymize PII before it reaches an LLM - with consistent, reversible labels."""

import os

# Defense-in-depth against catastrophic regex backtracking (ReDoS):
# presidio-analyzer reads this env var at import time and aborts any single
# regex search that exceeds it. Presidio's default of 60s is far too long
# for interactive prompt anonymization; 5s is still orders of magnitude
# above a healthy match. Set before anything imports presidio; users can
# override by exporting the variable themselves.
os.environ.setdefault("REGEX_TIMEOUT_SECONDS", "5")

from prompt_anonymizer.core import DEFAULT_ENTITIES, PromptAnonymizer
from prompt_anonymizer.exceptions import (
    ModelNotDownloadedError,
    PromptAnonymizerError,
    UnsupportedLanguageError,
)
from prompt_anonymizer.labeling import AnonymizeResult, EntitySpan
from prompt_anonymizer.scan import STRUCTURED_ENTITIES, guess_language, scan_text

__version__ = "0.2.0"

__all__ = [
    "DEFAULT_ENTITIES",
    "STRUCTURED_ENTITIES",
    "AnonymizeResult",
    "EntitySpan",
    "ModelNotDownloadedError",
    "PromptAnonymizer",
    "PromptAnonymizerError",
    "UnsupportedLanguageError",
    "__version__",
    "guess_language",
    "scan_text",
]
