"""Transformer NER backend tests (marker: slow; needs the hf extra + model download)."""

import importlib.util

import pytest

pytestmark = [
    pytest.mark.slow,
    pytest.mark.integration,
    pytest.mark.skipif(
        importlib.util.find_spec("transformers") is None
        or importlib.util.find_spec("torch") is None,
        reason="hf extra not installed",
    ),
]


@pytest.fixture(scope="module")
def pa_hf():
    from prompt_anonymizer import PromptAnonymizer

    return PromptAnonymizer(languages=["ja"], model_size="sm", ner_backend="hf")


def test_hf_backend_detects_person_and_location(pa_hf) -> None:
    result = pa_hf.anonymize(
        "山田太郎さんは東京都渋谷区に住んでいます。連絡先は 090-1234-5678 です。",
        language="ja",
    )
    assert "山田太郎" not in result.text
    assert "東京都渋谷区" not in result.text
    assert "<人名_1>" in result.text
    assert "<住所_1>" in result.text
    assert "<電話番号_1>" in result.text


def test_hf_backend_filters_unrequested_entities(pa_hf) -> None:
    # The ja model also tags ORG/PRD/EVT; those must never surface.
    result = pa_hf.anonymize("株式会社サンプルの佐藤一郎です。", language="ja")
    entity_types = {e.entity_type for e in result.entities}
    assert entity_types <= {
        "PERSON",
        "EMAIL_ADDRESS",
        "LOCATION",
        "PHONE_NUMBER",
        "JP_POSTAL_CODE",
        "JP_MY_NUMBER",
        "CREDIT_CARD",
        "CUSTOM",
    }


def test_hf_backend_roundtrip(pa_hf) -> None:
    text = "鈴木花子（〒150-0002、090-1111-2222、hanako@example.com）に連絡してください。"
    result = pa_hf.anonymize(text, language="ja")
    assert pa_hf.deanonymize(result.text, result.mapping) == text


def test_invalid_ner_backend_rejected() -> None:
    from prompt_anonymizer import PromptAnonymizer

    with pytest.raises(ValueError):
        PromptAnonymizer(languages=["ja"], ner_backend="bogus")
