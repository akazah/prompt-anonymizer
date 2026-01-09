"""Presidio-based text anonymization handler."""
import yaml
from typing import Dict, List, Any

from presidio_analyzer import AnalyzerEngine, RecognizerResult
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig
from colorama import Fore, Style

from config.constants import LANGUAGE_LABELS_PATH, LANGUAGES, ENTITIES
from config.nlp_models import NLP_ENGINE, NLP_MODELS


class PresidioHandler:
    """Handler for text anonymization using Microsoft Presidio."""

    def __init__(self):
        """Initialize Presidio analyzer and anonymizer engines."""
        self.languages = LANGUAGES
        self.entities = ENTITIES
        self.entities_language_labels = self._build_entities_language_labels(
            LANGUAGE_LABELS_PATH
        )

        self.analyzer = AnalyzerEngine(
            nlp_engine=NlpEngineProvider(
                nlp_configuration={
                    "nlp_engine_name": NLP_ENGINE,
                    "models": NLP_MODELS
                }
            ).create_engine(),
            supported_languages=self.languages
        )
        self.anonymizer = AnonymizerEngine()
        self.operators = {
            entity: OperatorConfig("hash") for entity in self.entities
        }

    def _build_entities_language_labels(
        self, language_labels_path: str
    ) -> Dict[str, Dict[str, str]]:
        """
        Build dictionary mapping entities to their labels in each language.

        Args:
            language_labels_path: Path to directory containing language label YAML files.

        Returns:
            Dictionary mapping entity types to language-specific labels.
        """
        return {
            entity: {
                lang: self._load_language_labels(language_labels_path, lang)[entity]
                for lang in self.languages
            }
            for entity in self.entities
        }

    def _load_language_labels(
        self, language_labels_path: str, language: str
    ) -> Dict[str, str]:
        """
        Load language-specific labels from YAML file.

        Args:
            language_labels_path: Path to directory containing language YAML files.
            language: Language code (e.g., 'en', 'ja').

        Returns:
            Dictionary of entity labels for the specified language.

        Raises:
            FileNotFoundError: If language file doesn't exist.
            yaml.YAMLError: If YAML file is malformed.
        """
        file_path = f'{language_labels_path}/{language}.yaml'
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            raise FileNotFoundError(
                f"Language file not found: {file_path}. "
                f"Supported languages: {', '.join(self.languages)}"
            )
        except yaml.YAMLError as e:
            raise yaml.YAMLError(f"Invalid YAML in {file_path}: {str(e)}")

    @staticmethod
    def _int_to_alphabet(num: int) -> str:
        """
        Convert integer to alphanumeric character for entity labeling.

        Args:
            num: Integer to convert (0-61).

        Returns:
            Corresponding character: A-Z (0-25), a-z (26-51), 0-9 (52-61).
        """
        if num < 26:
            return chr(65 + num)  # A-Z
        elif num < 52:
            return chr(97 + num - 26)  # a-z
        else:
            return chr(48 + num - 52)  # 0-9

    def _create_entities_hash_dict(
        self, items: List[RecognizerResult], language: str
    ) -> Dict[str, Dict[str, Any]]:
        """
        Create mapping of original text to anonymized replacements.

        Args:
            items: List of recognized entities from analyzer.
            language: Language code for label generation.

        Returns:
            Dictionary mapping original text to replacement info with 'replace' and 'count' keys.
        """
        entities_hash_dict: Dict[str, Dict[str, Any]] = {}

        for entity in self.entities:
            order = 0
            for item in items:
                if item.entity_type == entity:
                    if item.text not in entities_hash_dict:
                        label = self.entities_language_labels[entity][language]
                        replacement = f"{label}_{self._int_to_alphabet(order)}"
                        entities_hash_dict[item.text] = {
                            "replace": replacement,
                            "count": 1
                        }
                        order += 1
                    else:
                        entities_hash_dict[item.text]["count"] += 1

        return entities_hash_dict

    @staticmethod
    def _replace_hash_styled(
        text: str, entities_hash_dict: Dict[str, Dict[str, str]]
    ) -> str:
        """
        Replace entities with colored styled replacements for terminal display.

        Args:
            text: Text with hashed entities.
            entities_hash_dict: Mapping of original text to replacement info.

        Returns:
            Text with styled replacements.
        """
        for key, value in entities_hash_dict.items():
            replacement = f"{Fore.MAGENTA}{value['replace']}{Style.RESET_ALL}"
            text = text.replace(key, replacement)
        return text

    @staticmethod
    def _replace_hash(
        text: str, entities_hash_dict: Dict[str, Dict[str, str]]
    ) -> str:
        """
        Replace entities with plain text replacements.

        Args:
            text: Text with hashed entities.
            entities_hash_dict: Mapping of original text to replacement info.

        Returns:
            Text with plain replacements.
        """
        for key, value in entities_hash_dict.items():
            text = text.replace(key, value['replace'])
        return text

    def anonymize_text(self, text: str, language: str) -> Dict[str, str]:
        """
        Anonymize PII entities in text.

        Args:
            text: Original text to anonymize.
            language: Language code ('en', 'ja', etc.).

        Returns:
            Dictionary with 'styled_text' (colored for display) and 'text' (plain) keys.

        Raises:
            ValueError: If language is not supported.
        """
        if language not in self.languages:
            raise ValueError(
                f"Unsupported language: {language}. "
                f"Supported languages: {', '.join(self.languages)}"
            )

        if not text or not text.strip():
            return {"styled_text": "", "text": ""}

        anonymizer_result = self.anonymizer.anonymize(
            text=text,
            analyzer_results=self.analyzer.analyze(
                text=text,
                entities=self.entities,
                language=language
            ),
            operators=self.operators
        )

        items = anonymizer_result.items
        items.sort(key=lambda x: x.start)
        entities_hash_dict = self._create_entities_hash_dict(
            items=items, language=language
        )

        return {
            "styled_text": self._replace_hash_styled(
                text=anonymizer_result.text,
                entities_hash_dict=entities_hash_dict
            ),
            "text": self._replace_hash(
                text=anonymizer_result.text,
                entities_hash_dict=entities_hash_dict
            )
        }
