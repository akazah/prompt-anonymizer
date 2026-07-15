/**
 * Shared golden-set slice loader for UI package round-trip tests.
 * Mirrors web/e2e/tests/web-golden-roundtrip.spec.ts (regex-only, offline).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORTED_LANGUAGES } from "@prompt-anonymizer/core";
import type { Language } from "@prompt-anonymizer/core/languages";

export interface GoldenSpan {
  entity_type: string;
  value: string;
}

export interface GoldenCase {
  id: string;
  language: Language;
  text: string;
  spans: GoldenSpan[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(HERE, "../../../../tests/golden");

/** Keep small for PR CI; Playwright e2e uses 5 per language. */
export const CASES_PER_LANGUAGE = 2;

export const GOLDEN_LANGUAGES = SUPPORTED_LANGUAGES;

export function goldenSlice(
  language: Language,
  limit = CASES_PER_LANGUAGE,
): GoldenCase[] {
  const path = join(GOLDEN_DIR, `golden_${language}.json`);
  const cases = JSON.parse(readFileSync(path, "utf-8")) as GoldenCase[];
  return cases.slice(0, limit);
}

/** Structured entities with known ~1.0 regex recall (same rule as web e2e). */
export function mustBeMasked(span: GoldenSpan): boolean {
  return (
    span.entity_type === "EMAIL_ADDRESS" ||
    (span.entity_type === "JP_POSTAL_CODE" && span.value.startsWith("〒"))
  );
}
