"""Configuration constants for Prompt Anonymizer."""
from typing import List

# OpenAI Configuration
OPENAI_MODEL: str = "gpt-3.5-turbo"

# Internationalization Configuration
LANGUAGE_LABELS_PATH: str = "config/i18n/"
LANGUAGES: List[str] = ["en", "ja"]

# Presidio Entity Types
ENTITIES: List[str] = ["PERSON", "EMAIL_ADDRESS", "LOCATION", "PHONE_NUMBER"]
