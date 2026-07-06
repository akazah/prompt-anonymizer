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


def test_ja_credit_card_detected(pa_ja) -> None:
    result = pa_ja.anonymize("お支払いのカード番号は4111111111111111です。", language="ja")
    assert "4111111111111111" not in result.text
    assert "<クレジットカード_1>" in result.text


def test_ja_luhn_invalid_card_not_masked(pa_ja) -> None:
    result = pa_ja.anonymize("注文コードは4111111111111112です。", language="ja")
    assert "<クレジットカード_1>" not in result.text


def test_en_credit_card_detected(pa_en) -> None:
    result = pa_en.anonymize("The card on file is 4111-1111-1111-1111.", language="en")
    assert "4111-1111-1111-1111" not in result.text
    assert "<CreditCard_1>" in result.text


def test_anonymize_batch_matches_sequential(pa_ja) -> None:
    texts = [
        "山田太郎の電話は090-1234-5678です。",
        "送付先は〒100-0001、控えは taro@example.com へ。",
        "カード番号は 4111111111111111 です。",
    ]
    sequential = [pa_ja.anonymize(t, language="ja") for t in texts]
    batched = pa_ja.anonymize_batch(texts, language="ja", batch_size=2)
    assert [r.text for r in batched] == [r.text for r in sequential]
    assert [r.mapping for r in batched] == [r.mapping for r in sequential]
    for text, result in zip(texts, batched, strict=True):
        assert pa_ja.deanonymize(result.text, result.mapping) == text


def test_anonymize_batch_unsupported_language(pa_ja) -> None:
    from prompt_anonymizer import UnsupportedLanguageError

    with pytest.raises(UnsupportedLanguageError):
        pa_ja.anonymize_batch(["hello"], language="fr")


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


@pytest.fixture(scope="module")
def pa_en_opt_in():
    from prompt_anonymizer.core import DEFAULT_ENTITIES, PromptAnonymizer

    return PromptAnonymizer(
        languages=["en"],
        model_size="sm",
        entities=[*DEFAULT_ENTITIES, "US_SSN", "IBAN_CODE"],
    )


@pytest.fixture(scope="module")
def pa_ja_opt_in():
    from prompt_anonymizer.core import DEFAULT_ENTITIES, PromptAnonymizer

    return PromptAnonymizer(
        languages=["ja"],
        model_size="sm",
        entities=[*DEFAULT_ENTITIES, "US_SSN", "IBAN_CODE"],
    )


def test_en_ssn_and_iban_opt_in(pa_en_opt_in) -> None:
    text = "Payroll SSN 856-45-6780, reimbursement IBAN DE89 3704 0044 0532 0130 00."
    result = pa_en_opt_in.anonymize(text, language="en")
    assert "856-45-6780" not in result.text
    assert "DE89 3704 0044 0532 0130 00" not in result.text
    assert "<SSN_1>" in result.text
    assert "<IBAN_1>" in result.text
    assert pa_en_opt_in.deanonymize(result.text, result.mapping) == text


def test_ja_iban_and_ssn_adjacent_to_cjk_opt_in(pa_ja_opt_in) -> None:
    text = "社会保障番号は856-45-6780、振込先はDE89370400440532013000です"
    result = pa_ja_opt_in.anonymize(text, language="ja")
    assert "856-45-6780" not in result.text
    assert "DE89370400440532013000" not in result.text
    assert "<社会保障番号_1>" in result.text
    assert "<IBAN_1>" in result.text
    assert pa_ja_opt_in.deanonymize(result.text, result.mapping) == text


def test_ssn_and_iban_not_masked_by_default(pa_en) -> None:
    text = "Payroll SSN 856-45-6780, reimbursement IBAN DE89370400440532013000."
    result = pa_en.anonymize(text, language="en")
    assert "856-45-6780" in result.text
    assert "DE89370400440532013000" in result.text
    assert "<SSN_1>" not in result.text
    assert "<IBAN_1>" not in result.text
