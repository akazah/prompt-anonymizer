/**
 * Regex recognizers for structured PII, ported from the Python core
 * (`src/prompt_anonymizer/recognizers/`). NER-dependent entities (PERSON,
 * LOCATION) come from the pluggable NER backend instead.
 */

import { isValidIBAN } from "ibantools";
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

/** Mirrors Presidio's UsSsnRecognizer.invalidate_result (parity with the Python core). */
export function isValidUsSsn(candidate: string): boolean {
  const delimiters = candidate.match(/[.\- ]/g) ?? [];
  if (delimiters.length > 0) {
    const first = delimiters[0]!;
    if (!delimiters.every((d) => d === first)) return false;
  }
  const digits = candidate.replace(/[.\- ]/g, "");
  if (!/^\d{9}$/.test(digits)) return false;
  if (new Set(digits).size === 1) return false;
  if (digits.slice(3, 5) === "00") return false;
  if (digits.slice(5) === "0000") return false;
  const blockedPrefixes = ["000", "666", "123456789", "98765432", "078051120"];
  if (blockedPrefixes.some((prefix) => digits.startsWith(prefix))) return false;
  return true;
}

export function isValidIban(candidate: string): boolean {
  const compact = candidate.replace(/[ -]/g, "");
  return isValidIBAN(compact);
}

/**
 * Japanese phone numbers are 10 digits (11 for 050 IP phones). Mirrors
 * `JaPhoneRegexRecognizer.validate_result` in the Python core.
 */
export function isValidJaPhoneLength(candidate: string): boolean {
  const length = candidate.replace(/\D/g, "").length;
  return length === 10 || length === 11;
}

/** Luhn checksum used by credit card numbers (parity with the Python core). */
export function isValidCreditCard(candidate: string): boolean {
  const digits = candidate.replace(/[- ]/g, "");
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
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
  // JP landline: 03-1234-5678 / 0123-45-6789. JP numbers are 10 digits
  // (11 for 050 IP phones); the digit-count check keeps 9-digit strings
  // like US SSNs (097-87-8191) from being mistyped as phone numbers.
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)0\d{1,4}[-(]\d{1,4}[-)]\d{4}(?!\d)/g,
    score: 0.6,
    languages: "all",
    validate: isValidJaPhoneLength,
  },
  // US: (333) 333-3333 / 333-333-3333 / +1 333 333 3333
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)(?:\+1[ .-]?)?(?:\(\d{3}\)[ .-]?|\d{3}[ .-])\d{3}[ .-]\d{4}(?!\d)/g,
    score: 0.6,
    languages: "all",
  },
  // ES mobile with country prefix: +34 612 345 678 / +34612345678
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)\+34[ .-]?[6789]\d{2}[ .-]?\d{3}[ .-]?\d{3}(?!\d)/g,
    score: 0.6,
    languages: ["es"],
  },
  // ES 3-3-3 grouping, separators required without prefix: 612 345 678
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)[6789]\d{2}[ .-]\d{3}[ .-]\d{3}(?!\d)/g,
    score: 0.6,
    languages: ["es"],
  },
  // ES landline 2-3-2-2 grouping: 91 234 56 78
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)[89]\d[ .-]\d{3}[ .-]\d{2}[ .-]\d{2}(?!\d)/g,
    score: 0.5,
    languages: ["es"],
  },
  // VN domestic: 0912 345 678 / 091 234 5678 / 0912345678 / 024 3826 8888
  {
    entityType: "PHONE_NUMBER",
    regex:
      /(?<!\d)0(?:\d{2}[ .-]?\d{3}[ .-]?\d{4}|\d{3}[ .-]?\d{3}[ .-]?\d{3}|\d{2}[ .-]?\d{4}[ .-]?\d{4})(?!\d)/g,
    score: 0.6,
    languages: ["vi"],
  },
  // VN with +84 prefix (leading 0 dropped): +84 912 345 678
  {
    entityType: "PHONE_NUMBER",
    regex:
      /(?<!\d)\+84[ .-]?(?:\d{2}[ .-]?\d{3}[ .-]?\d{4}|\d{3}[ .-]?\d{3}[ .-]?\d{3}|\d{2}[ .-]?\d{4}[ .-]?\d{4})(?!\d)/g,
    score: 0.6,
    languages: ["vi"],
  },
  // CN mobile, 11 digits grouped 3-4-4: 138 0013 8000 / +86 138-0013-8000
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)(?:\+86[ .-]?)?1[3-9]\d[ .-]?\d{4}[ .-]?\d{4}(?!\d)/g,
    score: 0.6,
    languages: ["zh"],
  },
  // CN landline, 0-prefixed 3/4-digit area code + 7-8 digits: 010-12345678
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)(?:\+86[ .-]?)?0\d{2,3}[ .-]\d{7,8}(?!\d)/g,
    score: 0.5,
    languages: ["zh"],
  },
  // KR mobile: 010-1234-5678 / 01012345678
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)01[016789][ .-]?\d{3,4}[ .-]?\d{4}(?!\d)/g,
    score: 0.6,
    languages: ["ko"],
  },
  // KR with +82 prefix (leading 0 dropped): +82 10-1234-5678
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)\+82[ .-]?1[016789][ .-]?\d{3,4}[ .-]?\d{4}(?!\d)/g,
    score: 0.6,
    languages: ["ko"],
  },
  // KR landline: 02-123-4567 / 031-1234-5678
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)0(?:2|[3-6]\d)[ .-]\d{3,4}[ .-]\d{4}(?!\d)/g,
    score: 0.5,
    languages: ["ko"],
  },
  // FR, ten digits as five pairs: 06 12 34 56 78 / +33 6 12 34 56 78
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)(?:\+33[ .-]?[1-9]|0[1-9])(?:[ .-]?\d{2}){4}(?!\d)/g,
    score: 0.6,
    languages: ["fr"],
  },
  // DE with +49 prefix: +49 30 901820 / +49 171 2345678
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)\+49[ .-]?\d{2,4}[ /.-]?\d{4,8}(?!\d)/g,
    score: 0.6,
    languages: ["de"],
  },
  // DE domestic, separator required: 030 901820 / 0171 2345678 / 0711/123456
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)0\d{2,4}[ /.-]\d{4,8}(?!\d)/g,
    score: 0.5,
    languages: ["de"],
  },
  // PT with +351 prefix (separators optional): +351 912 345 678
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)\+351[ .-]?(?:9[1236]\d|2\d{2})[ .-]?\d{3}[ .-]?\d{3}(?!\d)/g,
    score: 0.6,
    languages: ["pt"],
  },
  // PT 3-3-3 grouping, separators required without prefix: 912 345 678
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)(?:9[1236]\d|2\d{2})[ .-]\d{3}[ .-]\d{3}(?!\d)/g,
    score: 0.6,
    languages: ["pt"],
  },
  // IT mobile, separators required without prefix: 333 123 4567
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)(?:\+39[ .-]?)?3\d{2}[ .-]\d{3}[ .-]\d{3,4}(?!\d)/g,
    score: 0.6,
    languages: ["it"],
  },
  // IT mobile with +39 prefix (separators optional): +39 3331234567
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)\+39[ .-]?3\d{2}[ .-]?\d{6,7}(?!\d)/g,
    score: 0.6,
    languages: ["it"],
  },
  // IT landline, separator required: 06 6982 1234 -> area code + body
  {
    entityType: "PHONE_NUMBER",
    regex: /(?<!\d)0\d{1,3}[ .-]\d{5,8}(?!\d)/g,
    score: 0.5,
    languages: ["it"],
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
  // Credit cards: Presidio's pattern with lookarounds instead of \b (which
  // never matches next to CJK text). Luhn-validated, hence the max score -
  // mirroring the Python core, where a passed checksum lifts the score to 1.0.
  {
    entityType: "CREDIT_CARD",
    regex:
      /(?<![\d-])(?!1\d{12}(?!\d))(?:4\d{3}|5[0-5]\d{2}|6\d{3}|1\d{3}|3\d{3})[- ]?\d{3,4}[- ]?\d{3,4}[- ]?\d{3,5}(?![\d-])/g,
    score: 1.0,
    languages: "all",
    validate: isValidCreditCard,
  },
  {
    entityType: "US_SSN",
    regex: /(?<![\d.-])\d{3}[- .]\d{2}[- .]\d{4}(?![\d.-])/g,
    score: 0.5,
    languages: "all",
    validate: isValidUsSsn,
  },
  // Bounded quantifiers only ({2,7} and {1,3}); no nested unbounded repeats.
  // Checksum-backed validation lifts matches to max score, mirroring CREDIT_CARD.
  {
    entityType: "IBAN_CODE",
    regex:
      /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]{4}){2,7}(?:[ -]?[A-Z0-9]{1,3})?(?![A-Za-z0-9])/g,
    score: 1.0,
    languages: "all",
    validate: isValidIban,
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
