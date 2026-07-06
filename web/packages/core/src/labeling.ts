/**
 * Label assignment and offset-based replacement.
 *
 * Kept in behavioural parity with the Python core
 * (`src/prompt_anonymizer/labeling.py`): spans are merged score-first,
 * identical source strings of the same entity type share a label, and
 * replacement runs end-first so offsets stay valid.
 */

import type { EntitySpan, Language } from "./types.js";

export const LABELS: Record<Language, Record<string, string>> = {
  en: {
    PERSON: "Name",
    EMAIL_ADDRESS: "Email",
    LOCATION: "Location",
    PHONE_NUMBER: "Phone",
    JP_POSTAL_CODE: "PostalCode",
    JP_MY_NUMBER: "MyNumber",
    CREDIT_CARD: "CreditCard",
    US_SSN: "SSN",
    IBAN_CODE: "IBAN",
    CUSTOM: "Custom",
  },
  ja: {
    PERSON: "人名",
    EMAIL_ADDRESS: "メールアドレス",
    LOCATION: "住所",
    PHONE_NUMBER: "電話番号",
    JP_POSTAL_CODE: "郵便番号",
    JP_MY_NUMBER: "マイナンバー",
    CREDIT_CARD: "クレジットカード",
    US_SSN: "社会保障番号",
    IBAN_CODE: "IBAN",
    CUSTOM: "秘匿情報",
  },
};

// Whitespace trimmed from the edges of remainder segments. An explicit set
// (rather than String.trim / str.strip) so both cores behave identically.
const STRIP_CHARS = " \t\n\r\u3000";

/**
 * Resolve overlaps, keeping the higher score (longer span on ties).
 *
 * A span that overlaps an already-kept span is not dropped outright: the
 * parts not covered by kept spans survive as trimmed remainder spans.
 * Dropping the whole span would leak the non-overlapping text — e.g. an
 * NER address span that also covers an already-masked postal code.
 * When `text` is given, remainder edges are trimmed of whitespace.
 */
export function mergeSpans(spans: EntitySpan[], text?: string): EntitySpan[] {
  const ordered = [...spans].sort(
    (a, b) => b.score - a.score || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const kept: EntitySpan[] = [];
  for (const span of ordered) {
    const blockers = kept
      .filter((k) => k.start < span.end && span.start < k.end)
      .sort((a, b) => a.start - b.start);
    if (blockers.length === 0) {
      kept.push(span);
      continue;
    }
    const segments: Array<[number, number]> = [];
    let cursor = span.start;
    for (const blocker of blockers) {
      if (blocker.start > cursor) segments.push([cursor, blocker.start]);
      cursor = Math.max(cursor, blocker.end);
    }
    if (cursor < span.end) segments.push([cursor, span.end]);
    for (let [segStart, segEnd] of segments) {
      if (text !== undefined) {
        while (segStart < segEnd && STRIP_CHARS.includes(text[segStart]!)) segStart++;
        while (segEnd > segStart && STRIP_CHARS.includes(text[segEnd - 1]!)) segEnd--;
      }
      if (segEnd > segStart) {
        kept.push({ start: segStart, end: segEnd, entityType: span.entityType, score: span.score });
      }
    }
  }
  return kept.sort((a, b) => a.start - b.start);
}

export function applyLabels(
  text: string,
  spans: EntitySpan[],
  labels: Record<string, string>,
): { text: string; mapping: Record<string, string> } {
  const merged = mergeSpans(spans, text);

  const labelBySource = new Map<string, string>();
  const counters = new Map<string, number>();
  const mapping: Record<string, string> = {};

  for (const span of merged) {
    const source = text.slice(span.start, span.end);
    const key = `${span.entityType}\u0000${source}`;
    if (!labelBySource.has(key)) {
      const next = (counters.get(span.entityType) ?? 0) + 1;
      counters.set(span.entityType, next);
      const labelName = labels[span.entityType] ?? span.entityType;
      const label = `<${labelName}_${next}>`;
      labelBySource.set(key, label);
      mapping[label] = source;
    }
  }

  let result = text;
  for (let i = merged.length - 1; i >= 0; i--) {
    const span = merged[i]!;
    const source = text.slice(span.start, span.end);
    const label = labelBySource.get(`${span.entityType}\u0000${source}`)!;
    result = result.slice(0, span.start) + label + result.slice(span.end);
  }

  return { text: result, mapping };
}

/** Restore original values; labels are replaced longest-first. */
export function deanonymize(text: string, mapping: Record<string, string>): string {
  const labels = Object.keys(mapping).sort((a, b) => b.length - a.length);
  let result = text;
  for (const label of labels) {
    result = result.split(label).join(mapping[label]!);
  }
  return result;
}
