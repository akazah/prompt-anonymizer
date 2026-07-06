"""Consistency tests for the language registry (single source of truth).

A "half-added" language - registered in ``languages.py`` but missing a
label file, model entry, golden set or README translation - must fail
here rather than surface as a confusing runtime error.
"""

import json
from importlib import resources
from pathlib import Path

import pytest

from prompt_anonymizer.core import _SPACY_MODELS, DEFAULT_HF_NER_MODELS
from prompt_anonymizer.languages import DEFAULT_LANGUAGES, SUPPORTED_LANGUAGES
from prompt_anonymizer.scan import guess_language

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_label_files_cover_supported_languages() -> None:
    # Same lookup mechanism as labeling.load_labels.
    labels_dir = resources.files("prompt_anonymizer").joinpath("labels")
    basenames = {
        entry.name.removesuffix(".yaml")
        for entry in labels_dir.iterdir()
        if entry.name.endswith(".yaml")
    }
    assert basenames == set(SUPPORTED_LANGUAGES)


@pytest.mark.parametrize("size", sorted(_SPACY_MODELS))
def test_spacy_models_cover_supported_languages(size: str) -> None:
    assert set(_SPACY_MODELS[size]) == set(SUPPORTED_LANGUAGES)


def test_hf_ner_models_cover_supported_languages() -> None:
    assert set(DEFAULT_HF_NER_MODELS) == set(SUPPORTED_LANGUAGES)


def test_golden_builders_cover_supported_languages() -> None:
    from prompt_anonymizer.evals.generate import _BUILDERS, _LOCALES

    assert set(_LOCALES) == set(SUPPORTED_LANGUAGES)
    assert set(_BUILDERS) == set(SUPPORTED_LANGUAGES)


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
    assert (REPO_ROOT / f"README_{language}.md").exists()


@pytest.mark.parametrize(
    "text",
    [
        "山田太郎の電話は090-1234-5678",
        "Xin chào, tôi tên là Nguyễn Văn A",
        "Buenos días, ¿cómo está usted?",
        "Hi, my name is John Smith",
        "",
    ],
)
def test_guess_language_returns_supported_language(text: str) -> None:
    assert guess_language(text) in SUPPORTED_LANGUAGES
