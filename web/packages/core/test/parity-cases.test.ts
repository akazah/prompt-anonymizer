/**
 * Cross-core parity cases against the hand-written fixture
 * (tests/golden/parity_cases.json), shared with the Python core
 * (tests/integration/test_parity_cases.py). One case per detection-target
 * behavior, each with a round-trip identity assertion (AGENTS.md).
 *
 * Runs the real Anonymizer without a NER backend: deterministic, offline.
 * PERSON/LOCATION cases are python-only in the fixture; the TS NER side is
 * covered by e2e:ner in weekly CI.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Anonymizer } from "../src/index.js";
import type { Language } from "../src/types.js";

interface MaskRequirement {
  entity_type: string;
  value: string;
  min_count?: number;
}

interface ParityCase {
  id: string;
  language: Language;
  text: string;
  cores: string[];
  must_mask?: MaskRequirement[];
  must_not_mask?: string[];
  must_not_detect?: { entity_type: string; value: string }[];
  deny_list?: string[];
  allow_list?: string[];
  notes?: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "../../../../tests/golden/parity_cases.json");
const CASES = (
  JSON.parse(readFileSync(FIXTURE, "utf-8")).cases as ParityCase[]
).filter((c) => c.cores.includes("ts"));

function occurrences(text: string, value: string): Array<[number, number]> {
  const found: Array<[number, number]> = [];
  let at = text.indexOf(value);
  while (at !== -1) {
    found.push([at, at + value.length]);
    at = text.indexOf(value, at + 1);
  }
  return found;
}

describe("parity cases (shared fixture)", () => {
  it.each(CASES.map((c) => [c.id, c] as const))("%s", async (_id, parityCase) => {
    const anonymizer = new Anonymizer({
      denyList: parityCase.deny_list,
      allowList: parityCase.allow_list,
    });
    const { text, language } = parityCase;
    const result = await anonymizer.anonymize(text, { language });

    for (const req of parityCase.must_mask ?? []) {
      const minCount = req.min_count ?? 1;
      expect(result.text, `${parityCase.id}: ${req.value} leaked`).not.toContain(req.value);
      const covered = occurrences(text, req.value).filter(([start, end]) =>
        result.entities.some(
          (span) => span.entityType === req.entity_type && span.start < end && start < span.end,
        ),
      );
      expect(
        covered.length,
        `${parityCase.id}: expected >= ${minCount} ${req.entity_type} span(s) over ${req.value}`,
      ).toBeGreaterThanOrEqual(minCount);
      if (minCount >= 2) {
        const labels = Object.entries(result.mapping)
          .filter(([, original]) => original === req.value)
          .map(([label]) => label);
        expect(labels, `${parityCase.id}: same value must reuse one label`).toHaveLength(1);
      }
    }

    for (const value of parityCase.must_not_mask ?? []) {
      expect(result.text, `${parityCase.id}: ${value} must survive verbatim`).toContain(value);
    }

    for (const req of parityCase.must_not_detect ?? []) {
      const hits = occurrences(text, req.value).flatMap(([start, end]) =>
        result.entities.filter(
          (span) => span.entityType === req.entity_type && span.start < end && start < span.end,
        ),
      );
      expect(hits, `${parityCase.id}: forbidden ${req.entity_type} span`).toHaveLength(0);
    }

    expect(
      anonymizer.deanonymize(result.text, result.mapping),
      `${parityCase.id}: round-trip identity failed`,
    ).toBe(text);
  });
});
