/**
 * Parity check against the Python-generated golden set (tests/golden/*.json).
 *
 * The TS core's regex recognizers must reach the same recall floors as the
 * Python core on structured PII. NER entities (PERSON / LOCATION) are
 * excluded here because tests run without a model download; their parity is
 * tracked in docs/EVAL.md instead.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LABELS, applyLabels, deanonymize, splitPersonName } from "../src/labeling.js";
import { FAMILY_NAME_FIRST, SUPPORTED_LANGUAGES } from "../src/languages.js";
import { detectWithRegex } from "../src/recognizers.js";
import type { Language } from "../src/types.js";

interface GoldenSpan {
  start: number;
  end: number;
  entity_type: string;
  value: string;
}

interface GoldenCase {
  id: string;
  language: Language;
  text: string;
  spans: GoldenSpan[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(HERE, "../../../../tests/golden");

const REGEX_ENTITIES = new Set([
  "EMAIL_ADDRESS",
  "PHONE_NUMBER",
  "JP_POSTAL_CODE",
  "JP_MY_NUMBER",
  "CREDIT_CARD",
  "US_SSN",
  "IBAN_CODE",
]);
const MIN_RECALL = 0.95;
const NAME_PART_TYPES = new Set([
  "PERSON_FIRST_NAME",
  "PERSON_MIDDLE_NAME",
  "PERSON_LAST_NAME",
]);
const PART_TYPE_BY_KEY: Record<string, string> = {
  first: "PERSON_FIRST_NAME",
  middle: "PERSON_MIDDLE_NAME",
  last: "PERSON_LAST_NAME",
};

function loadGolden(language: Language): GoldenCase[] {
  return JSON.parse(readFileSync(join(GOLDEN_DIR, `golden_${language}.json`), "utf-8"));
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

describe.each(SUPPORTED_LANGUAGES)("golden set parity (%s)", (language) => {
  it(`regex recall >= ${MIN_RECALL} per structured entity`, () => {
    const cases = loadGolden(language);
    expect(cases.length).toBeGreaterThan(0);

    const perEntity = new Map<string, { tp: number; fn: number }>();
    for (const goldenCase of cases) {
      const predictions = detectWithRegex(goldenCase.text, language);
      for (const gold of goldenCase.spans) {
        if (!REGEX_ENTITIES.has(gold.entity_type)) continue;
        const tally = perEntity.get(gold.entity_type) ?? { tp: 0, fn: 0 };
        const hit = predictions.some(
          (p) =>
            p.entityType === gold.entity_type &&
            overlaps(p.start, p.end, gold.start, gold.end),
        );
        if (hit) tally.tp++;
        else tally.fn++;
        perEntity.set(gold.entity_type, tally);
      }
    }
    expect(perEntity.size).toBeGreaterThan(0);
    for (const [entityType, { tp, fn }] of perEntity) {
      const recall = tp / (tp + fn);
      expect(recall, `${entityType}: recall ${recall.toFixed(3)} (${tp}/${tp + fn})`)
        .toBeGreaterThanOrEqual(MIN_RECALL);
    }
  });

  it("name-part splitting recall is 1.0 on golden PERSON spans", () => {
    const cases = loadGolden(language);
    const perEntity = new Map<string, { tp: number; fn: number }>();
    const familyNameFirst = FAMILY_NAME_FIRST[language];

    for (const goldenCase of cases) {
      const persons = goldenCase.spans.filter((s) => s.entity_type === "PERSON");
      const goldParts = goldenCase.spans.filter((s) => NAME_PART_TYPES.has(s.entity_type));
      const predicted: { start: number; end: number; entityType: string }[] = [];
      for (const person of persons) {
        const hasGoldParts = goldParts.some(
          (part) => person.start <= part.start && part.end <= person.end,
        );
        if (!hasGoldParts) continue;
        const source = goldenCase.text.slice(person.start, person.end);
        for (const { part, start: relStart, end: relEnd } of splitPersonName(
          source,
          familyNameFirst,
        )) {
          predicted.push({
            start: person.start + relStart,
            end: person.start + relEnd,
            entityType: PART_TYPE_BY_KEY[part],
          });
        }
      }
      const used = new Set<number>();
      for (const gold of goldParts) {
        const tally = perEntity.get(gold.entity_type) ?? { tp: 0, fn: 0 };
        const hitIndex = predicted.findIndex(
          (p, i) =>
            !used.has(i) &&
            p.entityType === gold.entity_type &&
            p.start === gold.start &&
            p.end === gold.end,
        );
        if (hitIndex >= 0) {
          used.add(hitIndex);
          tally.tp++;
        } else {
          tally.fn++;
        }
        perEntity.set(gold.entity_type, tally);
      }
    }

    for (const [entityType, { tp, fn }] of perEntity) {
      const recall = tp / (tp + fn);
      expect(recall, `${entityType}: recall ${recall.toFixed(3)} (${tp}/${tp + fn})`).toBe(1);
    }
  });

  it("split name-part labels round-trip to original text on golden cases", () => {
    const cases = loadGolden(language);
    for (const goldenCase of cases) {
      const spans = goldenCase.spans
        .filter((s) => !NAME_PART_TYPES.has(s.entity_type))
        .map((s) => ({
          start: s.start,
          end: s.end,
          entityType: s.entity_type,
          score: 1,
        }));
      const { text: anonymized, mapping } = applyLabels(
        goldenCase.text,
        spans,
        LABELS[language],
        { splitPersonNames: true, familyNameFirst: FAMILY_NAME_FIRST[language] },
      );
      expect(deanonymize(anonymized, mapping)).toBe(goldenCase.text);
    }
  });
});
