"""Integration tests using real spaCy `_sm` pipelines (marker: integration)."""

import pytest

pytestmark = pytest.mark.integration


@pytest.fixture(scope="module")
def pa_ja():
    from prompt_anonymizer import PromptAnonymizer

    return PromptAnonymizer(languages=["ja"], model_size="sm")


@pytest.fixture(scope="module")
def pa_en():
    from prompt_anonymizer import PromptAnonymizer

    return PromptAnonymizer(languages=["en"], model_size="sm")


def test_ja_phone_number_detected(pa_ja) -> None:
    result = pa_ja.anonymize("彼の電話番号は 090-1234-5678 です。", language="ja")
    assert "090-1234-5678" not in result.text
    assert "<電話番号_1>" in result.text
    assert result.mapping["<電話番号_1>"] == "090-1234-5678"


def test_ja_postal_code_detected(pa_ja) -> None:
    result = pa_ja.anonymize("送付先は 〒100-0001 です。", language="ja")
    assert "〒100-0001" not in result.text
    assert "<郵便番号_1>" in result.text


def test_ja_my_number_detected(pa_ja) -> None:
    from prompt_anonymizer.recognizers.my_number import my_number_check_digit

    body = "12345678901"
    number = body + str(my_number_check_digit(body))
    result = pa_ja.anonymize(f"マイナンバーは {number} です。", language="ja")
    assert number not in result.text
    assert "<マイナンバー_1>" in result.text


def test_ja_invalid_my_number_not_masked(pa_ja) -> None:
    body = "12345678901"
    from prompt_anonymizer.recognizers.my_number import my_number_check_digit

    wrong = (my_number_check_digit(body) + 1) % 10
    number = body + str(wrong)
    result = pa_ja.anonymize(f"注文番号は {number} です。", language="ja")
    assert "<マイナンバー_1>" not in result.text


def test_en_email_and_consistent_person(pa_en) -> None:
    text = "John lives in New York. Contact John at john@example.com."
    result = pa_en.anonymize(text, language="en")
    assert "john@example.com" not in result.text
    assert result.text.count("<Name_1>") == 2


def test_roundtrip_identity(pa_ja) -> None:
    text = "山田太郎（〒150-0002、090-1111-2222、taro@example.com）に連絡してください。"
    result = pa_ja.anonymize(text, language="ja")
    assert pa_ja.deanonymize(result.text, result.mapping) == text


def test_deny_and_allow_list() -> None:
    from prompt_anonymizer import PromptAnonymizer

    pa = PromptAnonymizer(
        languages=["ja"],
        deny_list=["プロジェクトX"],
        allow_list=["山田太郎"],
    )
    result = pa.anonymize("山田太郎はプロジェクトXの担当です。", language="ja")
    assert "プロジェクトX" not in result.text
    assert "山田太郎" in result.text


def test_unsupported_language_raises() -> None:
    from prompt_anonymizer import PromptAnonymizer, UnsupportedLanguageError

    pa = PromptAnonymizer(languages=["ja"])
    with pytest.raises(UnsupportedLanguageError):
        pa.anonymize("hello", language="fr")


def test_missing_model_error_message(monkeypatch) -> None:
    from prompt_anonymizer import ModelNotDownloadedError, PromptAnonymizer

    pa = PromptAnonymizer(languages=["ja"])
    import spacy.util

    monkeypatch.setattr(spacy.util, "is_package", lambda name: False)
    with pytest.raises(ModelNotDownloadedError, match="spacy download ja_core_news_sm"):
        pa.anonymize("テスト", language="ja")


def test_faker_roundtrip_50_cases(pa_ja, pa_en) -> None:
    """P2 gate: anonymize -> deanonymize must be identity on 50 seeded cases."""
    from prompt_anonymizer.evals.generate import generate_cases

    for language, pa in (("ja", pa_ja), ("en", pa_en)):
        for case in generate_cases(language, count=25):
            result = pa.anonymize(case.text, language=language)
            assert pa.deanonymize(result.text, result.mapping) == case.text
