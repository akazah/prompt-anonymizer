"""Consistency tests for the language registry (single source of truth).

A "half-added" language - registered in ``languages.py`` but missing a
label file, model entry, golden set or README translation - must fail
here rather than surface as a confusing runtime error.
"""

import json
import re
from importlib import resources
from pathlib import Path

import pytest

from prompt_anonymizer.core import DEFAULT_HF_NER_MODELS
from prompt_anonymizer.labeling import load_labels
from prompt_anonymizer.languages import (
    DEFAULT_LANGUAGES,
    DETECTION_RULES,
    LANGUAGES,
    SUPPORTED_LANGUAGES,
)
from prompt_anonymizer.scan import guess_language

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_registry_covers_ten_languages() -> None:
    assert len(SUPPORTED_LANGUAGES) == 10
    assert set(SUPPORTED_LANGUAGES) == set(LANGUAGES)
    assert len(set(SUPPORTED_LANGUAGES)) == len(SUPPORTED_LANGUAGES)


def test_label_files_cover_supported_languages() -> None:
    # Same lookup mechanism as labeling.load_labels.
    labels_dir = resources.files("prompt_anonymizer").joinpath("labels")
    basenames = {
        entry.name.removesuffix(".yaml")
        for entry in labels_dir.iterdir()
        if entry.name.endswith(".yaml")
    }
    assert basenames == set(SUPPORTED_LANGUAGES)


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


def test_hf_ner_models_cover_supported_languages() -> None:
    assert set(DEFAULT_HF_NER_MODELS) == set(SUPPORTED_LANGUAGES)


def test_golden_builders_cover_supported_languages() -> None:
    from prompt_anonymizer.evals.generate import _BESPOKE_BUILDERS, _GENERIC_SPECS, _LOCALES

    assert set(_LOCALES) == set(SUPPORTED_LANGUAGES)
    assert set(_BESPOKE_BUILDERS) | set(_GENERIC_SPECS) == set(SUPPORTED_LANGUAGES)


def test_default_languages_are_supported() -> None:
    assert set(DEFAULT_LANGUAGES) <= set(SUPPORTED_LANGUAGES)


@pytest.mark.parametrize("language", SUPPORTED_LANGUAGES)
def test_golden_set_exists_and_is_language_consistent(language: str) -> None:
    golden_path = REPO_ROOT / "tests" / "golden" / f"golden_{language}.json"
    assert golden_path.exists(), (
        f"missing golden set {golden_path}; run `uv run python -m prompt_anonymizer.evals`"
    )
    cases = json.loads(golden_path.read_text(encoding="utf-8"))
    assert cases, f"{golden_path} is empty"
    assert all(case["language"] == language for case in cases)


@pytest.mark.parametrize("language", [lang for lang in SUPPORTED_LANGUAGES if lang != "en"])
def test_readme_translation_exists(language: str) -> None:
    assert (REPO_ROOT / "docs" / "i18n" / f"README_{language}.md").exists()
    assert (REPO_ROOT / "docs" / "i18n" / "locales" / f"{language}.yaml").exists()


def test_readme_i18n_is_fresh() -> None:
    import subprocess

    result = subprocess.run(
        ["uv", "run", "python", "scripts/render_readme_i18n.py", "--check"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout


def test_detection_rules_reference_supported_languages_only() -> None:
    for language, regex in DETECTION_RULES:
        assert language in SUPPORTED_LANGUAGES
        re.compile(regex)


@pytest.mark.parametrize(
    "text",
    [
        "山田太郎の電話は090-1234-5678",
        "ｶﾀｶﾅﾉﾐ",
        "Xin chào, tôi tên là Nguyễn Văn A",
        "Buenos días, ¿cómo está usted?",
        "Hi, my name is John Smith",
        "请给我打电话",
        "전화해 주세요",
        "größere Straße",
        "informação não recebida",
        "ça marche très bien",
        "la città è però lontana",
        "",
    ],
)
def test_guess_language_returns_supported_language(text: str) -> None:
    assert guess_language(text) in SUPPORTED_LANGUAGES
