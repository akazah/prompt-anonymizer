"""Golden-set accuracy regression (marker: slow; weekly CI only)."""

import pytest

from prompt_anonymizer.languages import SUPPORTED_LANGUAGES

pytestmark = [pytest.mark.slow, pytest.mark.integration]

# Regression floors, intentionally below current measured values so that
# only real regressions fail the suite. Update after significant model or
# recognizer changes (see docs/EVAL.md for current numbers).
#
# Structured-PII floors (phone / email / card) apply to every language: the
# golden generator only emits notations the regex recognizers are built for.
# PERSON floors exist only where a baseline has been measured; NER quality
# for the newer languages is tracked in docs/EVAL.md before gating.
_STRUCTURED_FLOORS = {
    "PHONE_NUMBER": 0.9,
    "EMAIL_ADDRESS": 0.9,
    "CREDIT_CARD": 0.9,
}

MIN_RECALL = {
    (language, entity): floor
    for language in SUPPORTED_LANGUAGES
    for entity, floor in _STRUCTURED_FLOORS.items()
}
MIN_RECALL.update(
    {
        ("ja", "JP_POSTAL_CODE"): 0.9,
        ("ja", "JP_MY_NUMBER"): 0.9,
        ("en", "PERSON"): 0.7,
        ("es", "PERSON"): 0.5,
        # vi PERSON/LOCATION recall with the spaCy backend (xx_ent_wiki_sm) is
        # too weak to gate on; use ner_backend="hf" for Vietnamese names.
    }
)


@pytest.mark.parametrize("language", SUPPORTED_LANGUAGES)
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
