"""GLiNER NER backend tests (marker: slow; needs the gliner extra + model download)."""

import importlib.util

import pytest

pytestmark = [
    pytest.mark.slow,
    pytest.mark.integration,
    pytest.mark.skipif(
        importlib.util.find_spec("gliner") is None or importlib.util.find_spec("janome") is None,
        reason="gliner extra not installed",
    ),
]


@pytest.fixture(scope="module")
def pa_gliner_ja():
    from prompt_anonymizer import PromptAnonymizer

    return PromptAnonymizer(languages=["ja"], model_size="sm", ner_backend="gliner")


@pytest.fixture(scope="module")
def pa_gliner_en():
    from prompt_anonymizer import PromptAnonymizer

    return PromptAnonymizer(languages=["en"], model_size="sm", ner_backend="gliner")


def test_gliner_backend_detects_person_and_location_ja(pa_gliner_ja) -> None:
    result = pa_gliner_ja.anonymize(
        "山田太郎さんは東京都渋谷区に住んでいます。連絡先は 090-1234-5678 です。",
        language="ja",
    )
    assert "山田太郎" not in result.text
    assert "東京都渋谷区" not in result.text
    assert "<人名_1>" in result.text
    assert "<住所_1>" in result.text
    assert "<電話番号_1>" in result.text


def test_gliner_backend_detects_person_and_location_en(pa_gliner_en) -> None:
    result = pa_gliner_en.anonymize(
        "John Smith lives in Springfield. Reach him at john@example.com.",
        language="en",
    )
    assert "John Smith" not in result.text
    assert "Springfield" not in result.text
    assert "<Name_1>" in result.text
    assert "<Location_1>" in result.text
    assert "<Email_1>" in result.text


def test_gliner_backend_stays_scoped_to_contextual_entities(pa_gliner_ja) -> None:
    # Structured PII (emails, numbers) stays on the regex track; the GLiNER
    # recognizer must only ever contribute PERSON / LOCATION spans.
    result = pa_gliner_ja.anonymize(
        "佐藤一郎（sato@example.co.jp / 〒150-0002）まで。", language="ja"
    )
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


def test_gliner_backend_roundtrip(pa_gliner_ja) -> None:
    text = "鈴木花子（〒150-0002、090-1111-2222、hanako@example.com）に連絡してください。"
    result = pa_gliner_ja.anonymize(text, language="ja")
    assert pa_gliner_ja.deanonymize(result.text, result.mapping) == text
