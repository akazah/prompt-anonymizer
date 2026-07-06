"""Golden-set accuracy regression (marker: slow; weekly CI only)."""

import pytest

pytestmark = [pytest.mark.slow, pytest.mark.integration]

# Regression floors, intentionally below current measured values so that
# only real regressions fail the suite. Update after significant model or
# recognizer changes (see docs/EVAL.md for current numbers).
MIN_RECALL = {
    ("ja", "PHONE_NUMBER"): 0.9,
    ("ja", "EMAIL_ADDRESS"): 0.9,
    ("ja", "JP_POSTAL_CODE"): 0.9,
    ("ja", "CREDIT_CARD"): 0.9,
    ("en", "PHONE_NUMBER"): 0.9,
    ("en", "EMAIL_ADDRESS"): 0.9,
    ("en", "CREDIT_CARD"): 0.9,
    ("en", "PERSON"): 0.7,
    ("es", "PHONE_NUMBER"): 0.9,
    ("es", "EMAIL_ADDRESS"): 0.9,
    ("es", "CREDIT_CARD"): 0.9,
    ("es", "PERSON"): 0.5,
    # vi PERSON/LOCATION recall with the spaCy backend (xx_ent_wiki_sm) is
    # too weak to gate on; use ner_backend="hf" for Vietnamese names.
    ("vi", "PHONE_NUMBER"): 0.9,
    ("vi", "EMAIL_ADDRESS"): 0.9,
    ("vi", "CREDIT_CARD"): 0.9,
}


@pytest.mark.parametrize("language", ["ja", "en", "es", "vi"])
def test_recall_floor(language: str) -> None:
    from prompt_anonymizer import PromptAnonymizer
    from prompt_anonymizer.evals.generate import generate_cases
    from prompt_anonymizer.evals.metrics import evaluate_cases

    cases = generate_cases(language, count=60)
    pa = PromptAnonymizer(languages=[language], model_size="sm")
    predictions = [
        r.entities
        for r in pa.anonymize_batch([c.text for c in cases], language=language, batch_size=16)
    ]
    report = evaluate_cases(cases, predictions)

    for (lang, entity), floor in MIN_RECALL.items():
        if lang != language or entity not in report.per_entity:
            continue
        recall = report.per_entity[entity].recall
        assert recall >= floor, f"{lang}/{entity} recall {recall:.2f} < floor {floor}"
