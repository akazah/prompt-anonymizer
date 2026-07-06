"""Registry invariants: every supported language is fully wired up."""

import re

import pytest

from prompt_anonymizer.labeling import load_labels
from prompt_anonymizer.languages import DETECTION_RULES, LANGUAGES, SUPPORTED_LANGUAGES


def test_registry_covers_ten_languages() -> None:
    assert len(SUPPORTED_LANGUAGES) == 10
    assert set(SUPPORTED_LANGUAGES) == {
        "en",
        "ja",
        "es",
        "vi",
        "zh",
        "ko",
        "fr",
        "de",
        "pt",
        "it",
    }


@pytest.mark.parametrize("language", SUPPORTED_LANGUAGES)
def test_every_language_has_labels(language: str) -> None:
    labels = load_labels(language)
    assert set(labels) == set(load_labels("en"))
    assert all(labels.values())


@pytest.mark.parametrize("language", SUPPORTED_LANGUAGES)
def test_registry_config_is_consistent(language: str) -> None:
    config = LANGUAGES[language]
    assert config.code == language
    assert config.spacy_sm
    assert config.spacy_lg
    assert config.hf_ner_model
    if config.phone is not None:
        assert config.phone.region
        assert config.phone.patterns
        for pattern in config.phone.patterns:
            re.compile(pattern.regex)


def test_detection_rules_reference_supported_languages_only() -> None:
    for language, regex in DETECTION_RULES:
        assert language in SUPPORTED_LANGUAGES
        re.compile(regex)
