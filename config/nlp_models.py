"""NLP model configuration for Presidio analyzer."""
from typing import List, Dict, Any

# NLP Engine Configuration
NLP_ENGINE: str = "spacy"

# Language Models for Presidio
NLP_MODELS: List[Dict[str, Any]] = [
    {"lang_code": "en", "model_name": "en_core_web_lg"},
    {"lang_code": "ja", "model_name": "ja_core_news_lg"},
]
