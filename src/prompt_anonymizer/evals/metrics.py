"""Span-level precision / recall / F1 per entity type."""

from __future__ import annotations

from dataclasses import dataclass, field

from prompt_anonymizer.evals.generate import GoldenCase
from prompt_anonymizer.labeling import EntitySpan, split_person_name

NAME_PART_TYPES = frozenset(
    {
        "PERSON_FIRST_NAME",
        "PERSON_MIDDLE_NAME",
        "PERSON_LAST_NAME",
    }
)

_PART_TYPE_BY_KEY = {
    "first": "PERSON_FIRST_NAME",
    "middle": "PERSON_MIDDLE_NAME",
    "last": "PERSON_LAST_NAME",
}


@dataclass
class EntityMetrics:
    entity_type: str
    true_positives: int = 0
    false_positives: int = 0
    false_negatives: int = 0

    @property
    def precision(self) -> float:
        denom = self.true_positives + self.false_positives
        return self.true_positives / denom if denom else 0.0

    @property
    def recall(self) -> float:
        denom = self.true_positives + self.false_negatives
        return self.true_positives / denom if denom else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if (p + r) else 0.0


@dataclass
class EvalReport:
    language: str
    per_entity: dict[str, EntityMetrics] = field(default_factory=dict)

    def to_markdown_rows(self) -> list[str]:
        rows = []
        for entity in sorted(self.per_entity):
            m = self.per_entity[entity]
            rows.append(
                f"| {self.language} | {entity} | {m.precision:.2f} | {m.recall:.2f} "
                f"| {m.f1:.2f} | {m.true_positives + m.false_negatives} |"
            )
        return rows


def _overlaps(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return a_start < b_end and b_start < a_end


def evaluate_cases(
    cases: list[GoldenCase],
    predictions: list[list[EntitySpan]],
    entities: list[str] | None = None,
) -> EvalReport:
    """Score predictions against golden spans (overlap match, same entity type)."""
    if len(cases) != len(predictions):
        raise ValueError("cases and predictions must have equal length")
    language = cases[0].language if cases else "?"
    report = EvalReport(language=language)

    def metrics(entity: str) -> EntityMetrics:
        if entity not in report.per_entity:
            report.per_entity[entity] = EntityMetrics(entity_type=entity)
        return report.per_entity[entity]

    for case, preds in zip(cases, predictions, strict=True):
        golds = [
            g
            for g in case.spans
            if (entities is None or g.entity_type in entities)
            and g.entity_type not in NAME_PART_TYPES
        ]
        preds_f = [p for p in preds if entities is None or p.entity_type in entities]
        matched_preds: set[int] = set()
        for gold in golds:
            hit = False
            for i, pred in enumerate(preds_f):
                if (
                    i not in matched_preds
                    and pred.entity_type == gold.entity_type
                    and _overlaps(pred.start, pred.end, gold.start, gold.end)
                ):
                    matched_preds.add(i)
                    hit = True
                    break
            m = metrics(gold.entity_type)
            if hit:
                m.true_positives += 1
            else:
                m.false_negatives += 1
        for i, pred in enumerate(preds_f):
            if i not in matched_preds:
                metrics(pred.entity_type).false_positives += 1
    return report


def _exact_match(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return a_start == b_start and a_end == b_end


def evaluate_name_parts(
    cases: list[GoldenCase],
    *,
    family_name_first: bool,
) -> EvalReport:
    """Score ``split_person_name`` against golden name-part spans.

    Runs the heuristic on each golden PERSON span (no NER) and requires an
    exact offset + entity-type match for every recorded part span.
    """
    language = cases[0].language if cases else "?"
    report = EvalReport(language=language)

    def metrics(entity: str) -> EntityMetrics:
        if entity not in report.per_entity:
            report.per_entity[entity] = EntityMetrics(entity_type=entity)
        return report.per_entity[entity]

    for case in cases:
        persons = [s for s in case.spans if s.entity_type == "PERSON"]
        gold_parts = [s for s in case.spans if s.entity_type in NAME_PART_TYPES]
        predicted: list[EntitySpan] = []
        for person in persons:
            source = case.text[person.start : person.end]
            for part, rel_start, rel_end in split_person_name(source, family_name_first):
                predicted.append(
                    EntitySpan(
                        start=person.start + rel_start,
                        end=person.start + rel_end,
                        entity_type=_PART_TYPE_BY_KEY[part],
                        score=1.0,
                    )
                )
        matched_preds: set[int] = set()
        for gold in gold_parts:
            hit = False
            for i, pred in enumerate(predicted):
                if (
                    i not in matched_preds
                    and pred.entity_type == gold.entity_type
                    and _exact_match(pred.start, pred.end, gold.start, gold.end)
                ):
                    matched_preds.add(i)
                    hit = True
                    break
            m = metrics(gold.entity_type)
            if hit:
                m.true_positives += 1
            else:
                m.false_negatives += 1
        for i, pred in enumerate(predicted):
            if i not in matched_preds:
                metrics(pred.entity_type).false_positives += 1
    return report


def merge_reports(*reports: EvalReport) -> EvalReport:
    """Combine per-entity metrics from multiple reports for one language."""
    if not reports:
        return EvalReport(language="?")
    merged = EvalReport(language=reports[0].language)
    for report in reports:
        for entity, src in report.per_entity.items():
            dst = merged.per_entity.setdefault(entity, EntityMetrics(entity_type=entity))
            dst.true_positives += src.true_positives
            dst.false_positives += src.false_positives
            dst.false_negatives += src.false_negatives
    return merged
