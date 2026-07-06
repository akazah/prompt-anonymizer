/**
 * Parity-contract e2e: run a slice of the shared golden set
 * (tests/golden/*.json — the Python/TypeScript parity contract) through the
 * real UI and assert the anonymize -> restore round trip returns the exact
 * original text.
 *
 * Only structured entities with known ~1.0 regex recall (emails, 〒-marked
 * postal codes) are asserted as masked; NER entities are out of scope here.
 * Round-trip identity must hold regardless of what was detected.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { E2E_LANGUAGES, type E2eLanguage, anonymizeRegexOnly, expect, restore, test } from "./fixtures";

interface GoldenSpan {
  entity_type: string;
  value: string;
}

interface GoldenCase {
  id: string;
  language: E2eLanguage;
  text: string;
  spans: GoldenSpan[];
}

const CASES_PER_LANGUAGE = 5;

function goldenSlice(language: E2eLanguage): GoldenCase[] {
  const path = fileURLToPath(
    new URL(`../../../tests/golden/golden_${language}.json`, import.meta.url),
  );
  const cases = JSON.parse(readFileSync(path, "utf-8")) as GoldenCase[];
  return cases.slice(0, CASES_PER_LANGUAGE);
}

for (const language of E2E_LANGUAGES) {
  test(`golden ${language}: UI round trip restores the original text`, async ({ page }) => {
    for (const goldenCase of goldenSlice(language)) {
      // Fresh page per case so "output is non-empty" waits cannot race with
      // the previous case's result.
      await page.goto("/");
      const anonymized = await anonymizeRegexOnly(page, { language, text: goldenCase.text });

      for (const span of goldenCase.spans) {
        const mustBeMasked =
          span.entity_type === "EMAIL_ADDRESS" ||
          (span.entity_type === "JP_POSTAL_CODE" && span.value.startsWith("〒"));
        if (mustBeMasked) {
          expect(anonymized, `${goldenCase.id}: ${span.entity_type} leaked`).not.toContain(
            span.value,
          );
        }
      }

      const restored = await restore(page, anonymized);
      expect(restored, `${goldenCase.id}: round trip must be the identity`).toBe(goldenCase.text);
    }
  });
}
