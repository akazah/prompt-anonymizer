"""Label assignment and offset-based replacement.

This module is pure (no NLP engine required) so it can be unit-tested in
isolation and kept in behavioural parity with the TypeScript core in
``web/packages/core``.
"""

from __future__ import annotations

from collections.abc import Sequence
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


def deny_list_spans(text: str, deny_list: Sequence[str]) -> list[EntitySpan]:
    """Substring search for deny-listed terms (labelled ``CUSTOM``).

    Presidio's deny_list uses ``\\b`` word boundaries, which never match
    between Japanese characters, so we match plain substrings instead.
    Mirrors ``detectDenyList`` in the TypeScript core.
    """
    spans: list[EntitySpan] = []
    for needle in deny_list:
        if not needle:
            continue
        start = text.find(needle)
        while start != -1:
            spans.append(
                EntitySpan(start=start, end=start + len(needle), entity_type="CUSTOM", score=1.0)
            )
            start = text.find(needle, start + len(needle))
    return spans


# Whitespace trimmed from the edges of remainder segments. An explicit set
# (rather than str.strip / String.trim) so both cores behave identically.
_STRIP_CHARS = " \t\n\r\u3000"


def merge_spans(spans: list[EntitySpan], text: str | None = None) -> list[EntitySpan]:
    """Resolve overlaps, keeping the higher score (longer span on ties).

    A span that overlaps an already-kept span is not dropped outright: the
    parts not covered by kept spans survive as trimmed remainder spans.
    Dropping the whole span would leak the non-overlapping text - e.g. an
    NER address span that also covers an already-masked postal code.
    When ``text`` is given, remainder edges are trimmed of whitespace.
    Returns spans sorted by start offset.
    """
    ordered = sorted(spans, key=lambda s: (-s.score, -(s.end - s.start), s.start))
    kept: list[EntitySpan] = []
    for span in ordered:
        blockers = sorted(
            (k for k in kept if k.start < span.end and span.start < k.end),
            key=lambda k: k.start,
        )
        if not blockers:
            kept.append(span)
            continue
        segments: list[tuple[int, int]] = []
        cursor = span.start
        for blocker in blockers:
            if blocker.start > cursor:
                segments.append((cursor, blocker.start))
            cursor = max(cursor, blocker.end)
        if cursor < span.end:
            segments.append((cursor, span.end))
        for seg_start, seg_end in segments:
            if text is not None:
                while seg_start < seg_end and text[seg_start] in _STRIP_CHARS:
                    seg_start += 1
                while seg_end > seg_start and text[seg_end - 1] in _STRIP_CHARS:
                    seg_end -= 1
            if seg_end > seg_start:
                kept.append(
                    EntitySpan(
                        start=seg_start,
                        end=seg_end,
                        entity_type=span.entity_type,
                        score=span.score,
                    )
                )
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
    merged = merge_spans(spans, text)

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
