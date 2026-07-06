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
import { detectWithRegex } from "../src/recognizers.js";
import { LANGUAGES, type Language } from "../src/types.js";

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

function loadGolden(language: Language): GoldenCase[] {
  return JSON.parse(readFileSync(join(GOLDEN_DIR, `golden_${language}.json`), "utf-8"));
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

describe.each([...LANGUAGES] as const)("golden set parity (%s)", (language) => {
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
});
