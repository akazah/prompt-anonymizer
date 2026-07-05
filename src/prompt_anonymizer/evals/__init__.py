"""Accuracy evaluation harness (synthetic golden set + span metrics)."""

from prompt_anonymizer.evals.generate import GoldenCase, GoldenSpan, generate_cases
from prompt_anonymizer.evals.metrics import EntityMetrics, evaluate_cases

__all__ = ["EntityMetrics", "GoldenCase", "GoldenSpan", "evaluate_cases", "generate_cases"]
