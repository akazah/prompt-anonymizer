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
    CUSTOM: "秘匿情報",
  },
};

/** Drop overlapping spans, keeping the higher score (longer span on ties). */
export function mergeSpans(spans: EntitySpan[]): EntitySpan[] {
  const ordered = [...spans].sort(
    (a, b) => b.score - a.score || b.end - b.start - (a.end - a.start) || a.start - b.start,
  );
  const kept: EntitySpan[] = [];
  for (const span of ordered) {
    if (kept.every((k) => span.end <= k.start || span.start >= k.end)) {
      kept.push(span);
    }
  }
  return kept.sort((a, b) => a.start - b.start);
}

export function applyLabels(
  text: string,
  spans: EntitySpan[],
  labels: Record<string, string>,
): { text: string; mapping: Record<string, string> } {
  const merged = mergeSpans(spans);

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
