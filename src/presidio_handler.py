import yaml

from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

from colorama import Fore, Style

from config.constants import LANGUAGE_LABELS_PATH, LANGUAGES, ENTITIES
from config.nlp_models import NLP_ENGINE, NLP_MODELS


class PresidioHandler:
    def __init__(self):
        self.languages = LANGUAGES
        self.entities = ENTITIES
        self.entities_language_labels = self._build_entities_language_labels(LANGUAGE_LABELS_PATH)

        self.analyzer = AnalyzerEngine(
            nlp_engine=NlpEngineProvider(
                nlp_configuration={
                    "nlp_engine_name": NLP_ENGINE,
                    "models": NLP_MODELS}
            ).create_engine(),
            supported_languages=self.languages
        )
        self.anonymizer = AnonymizerEngine()
        self.operators = {entity: OperatorConfig("hash") for entity in self.entities}
    
    def _build_entities_language_labels(self, language_labels_path):
        return {
            entity: {
                lang: self._load_language_labels(language_labels_path, lang)[entity] 
                for lang in self.languages
            } 
            for entity in self.entities
        }
    
    def _load_language_labels(self, language_labels_path, language):
        with open(f'{language_labels_path}/{language}.yaml', 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    @staticmethod
    def _int_to_alphabet(num):
        if num < 26:
            return chr(65 + num)
        elif num < 52:
            return chr(97 + num - 26)
        else:
            return chr(48 + num - 52)

    def _create_entities_hash_dict(self, items, language):
        entities_hash_dict = {}
        for entity in self.entities:
            order = 0
            for item in items:
                if item.entity_type == entity:
                    if item.text not in entities_hash_dict:
                        entities_hash_dict[item.text] = {"replace": self.entities_language_labels[entity][language] + "_" + self._int_to_alphabet(order), "count": 1}
                        order += 1
                    else:
                        entities_hash_dict[item.text]["count"] += 1
        return entities_hash_dict

    @staticmethod
    def _replace_hash_styled(text, entities_hash_dict):
        for key, value in entities_hash_dict.items():
            text = text.replace(key, f"{Fore.MAGENTA}{value['replace']}{Style.RESET_ALL}")
        return text

    @staticmethod
    def _replace_hash(text, entities_hash_dict):
        for key, value in entities_hash_dict.items():
            text = text.replace(key, f"{value['replace']}")
        return text

    def anonymize_text(self, text, language):
        anonymizer_result = self.anonymizer.anonymize(
            text=text,
            analyzer_results=self.analyzer.analyze(text=text, entities=self.entities, language=language),
            operators=self.operators
        )

        items = anonymizer_result.items
        items.sort(key=lambda x: x.start)
        entities_hash_dict = self._create_entities_hash_dict(items=items, language=language)

        return {
            "styled_text": self._replace_hash_styled(text=anonymizer_result.text, entities_hash_dict=entities_hash_dict),
            "text": self._replace_hash(text=anonymizer_result.text, entities_hash_dict=entities_hash_dict)
        }
