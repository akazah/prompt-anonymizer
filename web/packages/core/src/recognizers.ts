/**
 * Regex recognizers for structured PII, ported from the Python core
 * (`src/prompt_anonymizer/recognizers/`). NER-dependent entities (PERSON,
 * LOCATION) come from the pluggable NER backend instead.
 */

import type { EntitySpan, Language } from "./types.js";

interface RegexRule {
  entityType: string;
  regex: RegExp;
  score: number;
  languages: Language[] | "all";
  validate?: (match: string) => boolean;
}

/** Check digit for the 12-digit Japanese My Number (MIC ordinance). */
export function myNumberCheckDigit(digits: string): number {
  if (!/^\d{11}$/.test(digits)) throw new Error("expected 11 digits");
  let total = 0;
  for (let n = 1; n <= 11; n++) {
    const p = Number(digits[11 - n]);
    const q = n <= 6 ? n + 1 : n - 5;
    total += p * q;
  }
  const remainder = total % 11;
  return remainder <= 1 ? 0 : 11 - remainder;
}

export function isValidMyNumber(candidate: string): boolean {
  const normalized = candidate.replace(/[- ]/g, "");
  if (!/^\d{12}$/.test(normalized)) return false;
  return myNumberCheckDigit(normalized.slice(0, 11)) === Number(normalized[11]);
}

const RULES: RegexRule[] = [
  {
    entityType: "EMAIL_ADDRESS",
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    score: 0.9,
    languages: "all",
  },
  // JP mobile: 090-1234-5678 / 09012345678 / 090(1234)5678
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)0[789]0[-( ]?\d{4}[-) ]?\d{4}(?!\d)/g,
    score: 0.7,
    languages: "all",
  },
  // JP toll-free: 0120-123-456
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)0120[- ]?\d{3}[- ]?\d{3}(?!\d)/g,
    score: 0.7,
    languages: "all",
  },
  // JP landline: 03-1234-5678 / 0123-45-6789
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)0\d{1,4}[-(]\d{1,4}[-)]\d{4}(?!\d)/g,
    score: 0.6,
    languages: "all",
  },
  // US: (333) 333-3333 / 333-333-3333 / +1 333 333 3333
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)(?:\+1[ .-]?)?(?:\(\d{3}\)[ .-]?|\d{3}[ .-])\d{3}[ .-]\d{4}(?!\d)/g,
    score: 0.6,
    languages: "all",
  },
  // JP postal code with 〒 mark (strong signal).
  {
    entityType: "JP_POSTAL_CODE",
    regex: /〒\s?\d{3}-?\d{4}/g,
    score: 0.9,
    languages: "all",
  },
  // Bare NNN-NNNN: weak, kept below the default threshold unless ja context.
  {
    entityType: "JP_POSTAL_CODE",
    regex: /(?<![\d-])\d{3}-\d{4}(?![\d-])/g,
    score: 0.35,
    languages: ["ja"],
  },
  {
    entityType: "JP_MY_NUMBER",
    regex: /(?<![\d-])\d{4}[- ]?\d{4}[- ]?\d{4}(?![\d-])/g,
    score: 0.7,
    languages: "all",
    validate: isValidMyNumber,
  },
];

export function detectWithRegex(text: string, language: Language): EntitySpan[] {
  const spans: EntitySpan[] = [];
  for (const rule of RULES) {
    if (rule.languages !== "all" && !rule.languages.includes(language)) continue;
    const regex = new RegExp(rule.regex.source, rule.regex.flags);
    for (const match of text.matchAll(regex)) {
      const value = match[0];
      if (rule.validate && !rule.validate(value)) continue;
      spans.push({
        start: match.index,
        end: match.index + value.length,
        entityType: rule.entityType,
        score: rule.score,
      });
    }
  }
  return spans;
}

/** Find every occurrence of deny-listed strings (always masked as CUSTOM). */
export function detectDenyList(text: string, denyList: string[]): EntitySpan[] {
  const spans: EntitySpan[] = [];
  for (const needle of denyList) {
    if (!needle) continue;
    let from = 0;
    for (;;) {
      const at = text.indexOf(needle, from);
      if (at === -1) break;
      spans.push({ start: at, end: at + needle.length, entityType: "CUSTOM", score: 1.0 });
      from = at + needle.length;
    }
  }
  return spans;
}
