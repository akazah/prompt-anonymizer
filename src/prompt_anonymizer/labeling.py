"""Label assignment and offset-based replacement.

This module is pure (no NLP engine required) so it can be unit-tested in
isolation and kept in behavioural parity with the TypeScript core in
``web/packages/core``.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from importlib import resources
from typing import Any

import yaml

LABEL_TEMPLATE = "<{label}_{index}>"

# Name-part labels append a localized part word to the person label, e.g.
# <Name_1_First_Name> / <人名_1_姓>. Parts of the same person share the
# person index, so an LLM can tell which parts belong together.
PART_LABEL_TEMPLATE = "<{label}_{index}_{part}>"

# Label-file keys for the localized part words (see labels/<lang>.yaml).
_NAME_PART_KEYS = {
    "first": "PERSON_FIRST_NAME",
    "middle": "PERSON_MIDDLE_NAME",
    "last": "PERSON_LAST_NAME",
}

# Surname particles for given-name-first languages: a token from this set
# (compared lowercase) starts the family name, so "Vincent van Gogh" splits
# into first="Vincent", last="van Gogh" rather than a bogus middle name.
_SURNAME_PARTICLES = frozenset(
    {
        "al",
        "bin",
        "binti",
        "da",
        "das",
        "de",
        "degli",
        "del",
        "della",
        "den",
        "der",
        "di",
        "dos",
        "du",
        "el",
        "la",
        "le",
        "ten",
        "ter",
        "van",
        "von",
    }
)


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


# NER entity types whose detected values are propagated to exact repeats.
_PROPAGATE_TYPES = frozenset({"PERSON", "LOCATION"})

# Word characters of space-delimited (Latin-script) text, used as a boundary
# guard so a propagated value never matches inside a longer word ("An" in
# "Anh"). CJK/kana neighbours are intentionally not word-like here so
# "山田太郎さん" still matches. Keep in parity with LATIN_WORD in the
# TypeScript core's recognizers.ts.
_LATIN_WORD = re.compile("[0-9A-Za-z\\u00C0-\\u024F\\u1E00-\\u1EFF]")


def propagate_entity_values(text: str, spans: Sequence[EntitySpan]) -> list[EntitySpan]:
    """Propagate NER-detected values to exact occurrences the model missed.

    NER models can skip a repeat of an entity they detected elsewhere in
    the same text (e.g. a person name right after an honorific at sentence
    start). An exact repeat of a detected value is the same PII, so every
    uncovered occurrence gets a span with the seed detection's type and
    score. Mirrors ``propagateEntityValues`` in the TypeScript core.
    """
    occupied = [(span.start, span.end) for span in spans]

    def overlaps(start: int, end: int) -> bool:
        return any(start < o_end and o_start < end for o_start, o_end in occupied)

    seeds: dict[tuple[str, str], float] = {}
    for span in sorted(spans, key=lambda s: s.start):
        if span.entity_type not in _PROPAGATE_TYPES:
            continue
        value = text[span.start : span.end]
        if len(value.strip()) < 2:
            continue
        key = (span.entity_type, value)
        seeds[key] = max(seeds.get(key, span.score), span.score)

    extra: list[EntitySpan] = []
    for (entity_type, value), score in seeds.items():
        start = text.find(value)
        while start != -1:
            end = start + len(value)
            at = start
            start = text.find(value, end)
            if overlaps(at, end):
                continue
            before = text[at - 1] if at > 0 else ""
            after = text[end] if end < len(text) else ""
            if (before and _LATIN_WORD.match(before) and _LATIN_WORD.match(value[0])) or (
                after and _LATIN_WORD.match(after) and _LATIN_WORD.match(value[-1])
            ):
                continue
            extra.append(EntitySpan(start=at, end=end, entity_type=entity_type, score=score))
            occupied.append((at, end))
    return extra


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


def split_person_name(source: str, family_name_first: bool) -> list[tuple[str, int, int]]:
    """Split a PERSON source string into name parts, when possible.

    Returns ``(part, start, end)`` triples ("first" / "middle" / "last",
    offsets relative to ``source``) in text order, or an empty list when the
    name has fewer than two whitespace-separated tokens (e.g. "山田太郎" -
    splitting unspaced CJK names would require a name dictionary, so they
    keep a plain person label). Consecutive middle tokens form one
    contiguous part so each part label maps to exactly one value.

    ``family_name_first`` follows the language's native order (ja/zh/ko/vi:
    family name first); given-name-first languages additionally attach
    surname particles ("van", "de", ...) to the last name.
    Mirrors ``splitPersonName`` in the TypeScript core.
    """
    tokens: list[tuple[int, int]] = []
    cursor = 0
    while cursor < len(source):
        if source[cursor] in _STRIP_CHARS:
            cursor += 1
            continue
        end = cursor
        while end < len(source) and source[end] not in _STRIP_CHARS:
            end += 1
        tokens.append((cursor, end))
        cursor = end
    if len(tokens) < 2:
        return []

    if family_name_first:
        parts = [("last", tokens[0][0], tokens[0][1])]
        middle = tokens[1:-1]
        if middle:
            parts.append(("middle", middle[0][0], middle[-1][1]))
        parts.append(("first", tokens[-1][0], tokens[-1][1]))
        return parts

    last_start = len(tokens) - 1
    for i in range(1, len(tokens) - 1):
        if source[tokens[i][0] : tokens[i][1]].lower() in _SURNAME_PARTICLES:
            last_start = i
            break
    parts = [("first", tokens[0][0], tokens[0][1])]
    middle = tokens[1:last_start]
    if middle:
        parts.append(("middle", middle[0][0], middle[-1][1]))
    parts.append(("last", tokens[last_start][0], tokens[-1][1]))
    return parts


def apply_labels(
    text: str,
    spans: list[EntitySpan],
    labels: dict[str, str],
    *,
    split_person_names: bool = False,
    family_name_first: bool = False,
) -> tuple[str, dict[str, str]]:
    """Replace spans (end-first) with consistent labels.

    Identical source strings of the same entity type receive the same label.
    Returns the anonymized text and a ``label -> original`` mapping.

    With ``split_person_names``, multi-token PERSON spans are labelled per
    name part (``<Name_1_First_Name>`` / ``<人名_1_姓>`` ...), sharing one
    person index per unique full name; a later single-token PERSON span
    matching an already-seen part value reuses that part's label, so
    "John Smith ... John" stays consistent.
    """
    merged = merge_spans(spans, text)

    label_by_source: dict[tuple[str, str], str] = {}
    counters: dict[str, int] = {}
    mapping: dict[str, str] = {}
    person_index_by_source: dict[str, int] = {}
    part_label_by_value: dict[str, str] = {}
    replacements: list[tuple[int, int, str]] = []

    for span in merged:
        source = text[span.start : span.end]
        if split_person_names and span.entity_type == "PERSON":
            parts = split_person_name(source, family_name_first)
            if parts:
                if source not in person_index_by_source:
                    counters[span.entity_type] = counters.get(span.entity_type, 0) + 1
                    person_index_by_source[source] = counters[span.entity_type]
                index = person_index_by_source[source]
                person_word = labels.get(span.entity_type, span.entity_type)
                for part, rel_start, rel_end in parts:
                    value = source[rel_start:rel_end]
                    part_word = labels.get(_NAME_PART_KEYS[part], _NAME_PART_KEYS[part])
                    label = PART_LABEL_TEMPLATE.format(
                        label=person_word, index=index, part=part_word
                    )
                    mapping.setdefault(label, value)
                    part_label_by_value.setdefault(value, label)
                    replacements.append((span.start + rel_start, span.start + rel_end, label))
                continue
            if source in part_label_by_value:
                replacements.append((span.start, span.end, part_label_by_value[source]))
                continue
        key = (span.entity_type, source)
        if key not in label_by_source:
            counters[span.entity_type] = counters.get(span.entity_type, 0) + 1
            label_name = labels.get(span.entity_type, span.entity_type)
            label = LABEL_TEMPLATE.format(label=label_name, index=counters[span.entity_type])
            label_by_source[key] = label
            mapping[label] = source
        replacements.append((span.start, span.end, label_by_source[key]))

    result = text
    for start, end, label in reversed(replacements):
        result = result[:start] + label + result[end:]

    return result, mapping


def deanonymize(text: str, mapping: dict[str, str]) -> str:
    """Restore original values in ``text`` using an anonymize mapping.

    Labels are replaced longest-first to avoid partial-label collisions.
    """
    for label in sorted(mapping, key=len, reverse=True):
        text = text.replace(label, mapping[label])
    return text
