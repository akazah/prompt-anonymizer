"""Label assignment and offset-based replacement.

This module is pure (no NLP engine required) so it can be unit-tested in
isolation and kept in behavioural parity with the TypeScript core in
``web/packages/core``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from importlib import resources
from typing import Any

import yaml

LABEL_TEMPLATE = "<{label}_{index}>"


@dataclass(frozen=True)
class EntitySpan:
    """A detected PII span in the original text."""

    start: int
    end: int
    entity_type: str
    score: float


@dataclass
class AnonymizeResult:
    """Result of :meth:`PromptAnonymizer.anonymize`."""

    text: str
    mapping: dict[str, str]
    entities: list[EntitySpan] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "mapping": self.mapping,
            "entities": [
                {
                    "start": e.start,
                    "end": e.end,
                    "entity_type": e.entity_type,
                    "score": e.score,
                }
                for e in self.entities
            ],
        }


def load_labels(language: str) -> dict[str, str]:
    """Load entity-type -> human label translations bundled with the package."""
    ref = resources.files("prompt_anonymizer").joinpath(f"labels/{language}.yaml")
    with ref.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):  # pragma: no cover - corrupt package data
        raise ValueError(f"Invalid label file for language '{language}'")
    return {str(k): str(v) for k, v in data.items()}


def merge_spans(spans: list[EntitySpan]) -> list[EntitySpan]:
    """Drop overlapping spans, keeping the higher score (longer span on ties).

    Returns spans sorted by start offset.
    """
    ordered = sorted(spans, key=lambda s: (-s.score, -(s.end - s.start), s.start))
    kept: list[EntitySpan] = []
    for span in ordered:
        if all(span.end <= k.start or span.start >= k.end for k in kept):
            kept.append(span)
    return sorted(kept, key=lambda s: s.start)


def apply_labels(
    text: str,
    spans: list[EntitySpan],
    labels: dict[str, str],
) -> tuple[str, dict[str, str]]:
    """Replace spans (end-first) with consistent labels.

    Identical source strings of the same entity type receive the same label.
    Returns the anonymized text and a ``label -> original`` mapping.
    """
    merged = merge_spans(spans)

    label_by_source: dict[tuple[str, str], str] = {}
    counters: dict[str, int] = {}
    mapping: dict[str, str] = {}

    for span in merged:
        source = text[span.start : span.end]
        key = (span.entity_type, source)
        if key not in label_by_source:
            counters[span.entity_type] = counters.get(span.entity_type, 0) + 1
            label_name = labels.get(span.entity_type, span.entity_type)
            label = LABEL_TEMPLATE.format(label=label_name, index=counters[span.entity_type])
            label_by_source[key] = label
            mapping[label] = source

    result = text
    for span in reversed(merged):
        source = text[span.start : span.end]
        label = label_by_source[(span.entity_type, source)]
        result = result[: span.start] + label + result[span.end :]

    return result, mapping


def deanonymize(text: str, mapping: dict[str, str]) -> str:
    """Restore original values in ``text`` using an anonymize mapping.

    Labels are replaced longest-first to avoid partial-label collisions.
    """
    for label in sorted(mapping, key=len, reverse=True):
        text = text.replace(label, mapping[label])
    return text
