"""Single source of truth for the languages both cores support.

To add a language, extend :data:`SUPPORTED_LANGUAGES` here; CLI validation,
eval defaults and the consistency tests all derive from it. The tests in
``tests/unit/test_languages.py`` then point at every remaining gap
(labels, models, golden sets, README translation).
Mirror of ``web/packages/core/src/languages.ts``.
"""

from __future__ import annotations

#: Display / evaluation order.
SUPPORTED_LANGUAGES = ("ja", "en", "es", "vi")

#: Languages a default :class:`~prompt_anonymizer.core.PromptAnonymizer` loads models for.
DEFAULT_LANGUAGES = ("en", "ja")
