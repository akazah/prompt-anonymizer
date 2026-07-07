"""Golden sets must match what evals/generate.py produces today.

Catches "changed the generator but forgot to regenerate the golden set"
- the committed JSON is the parity contract with the TypeScript core.
Generation is Faker-only (no models), so this stays fast.
"""

import json
from pathlib import Path

import pytest

from prompt_anonymizer.evals.generate import generate_cases
from prompt_anonymizer.languages import SUPPORTED_LANGUAGES

GOLDEN_DIR = Path(__file__).resolve().parents[1] / "golden"


@pytest.mark.parametrize("language", SUPPORTED_LANGUAGES)
def test_golden_set_matches_generator(language: str) -> None:
    generated = [case.to_dict() for case in generate_cases(language, count=200)]
    golden_path = GOLDEN_DIR / f"golden_{language}.json"
    committed = json.loads(golden_path.read_text(encoding="utf-8"))
    assert committed == generated, (
        f"{golden_path} is stale: the generator now produces different cases. "
        "Regenerate the golden sets and docs/EVAL.md with "
        "`uv run python -m prompt_anonymizer.evals`."
    )
