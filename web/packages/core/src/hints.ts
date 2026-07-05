/**
 * Optional placeholder hints: keep a controlled amount of non-identifying
 * context inside a label, e.g. `<住所_1:東京都>`, `<電話番号_1:携帯>`,
 * `<人名_1:同姓A>`.
 *
 * PRIVACY TRADE-OFF: every hint intentionally leaks a coarse fact about the
 * original value (region, phone line type / area code, or that two names in
 * the same text share a family name). All hints are opt-in and default to
 * "none"; the default label format is unchanged.
 *
 * Hints derive only from the source strings inside the current text — the
 * person hint in particular never reveals the surname itself, only that
 * names within this one prompt are related.
 */

import type { Language } from "./types.js";

export interface HintOptions {
  /** Keep coarse geography: prefecture (都道府県) or municipality (市区町村). */
  location?: "none" | "prefecture" | "municipality";
  /** Keep the phone line type (mobile/landline/toll-free) or the area code. */
  phone?: "none" | "lineType" | "areaCode";
  /**
   * Mark person names that share a family name within this text with the
   * same group tag (同姓A / FamilyA). The surname itself is not revealed.
   */
  person?: "none" | "sharedSurname";
}

export interface HintItem {
  entityType: string;
  source: string;
}

const PREFECTURE = /^(北海道|東京都|京都府|大阪府|[\u4e00-\u9fff\u3041-\u3096\u30a1-\u30fa]{2,3}県)/u;
const MUNICIPALITY = /^[\u4e00-\u9fff\u3041-\u3096\u30a1-\u30faー]{1,7}?[市区町村]/u;

/** 東京都中央区銀座1-2-3 -> 東京都 (prefecture) or 東京都中央区 (municipality). */
export function locationHint(
  source: string,
  granularity: "prefecture" | "municipality",
): string | null {
  const trimmed = source.trim();
  const prefMatch = trimmed.match(PREFECTURE);
  const prefecture = prefMatch?.[0] ?? null;
  if (granularity === "prefecture") return prefecture;
  const rest = prefecture ? trimmed.slice(prefecture.length) : trimmed;
  const muniMatch = rest.match(MUNICIPALITY);
  if (muniMatch) return (prefecture ?? "") + muniMatch[0];
  return prefecture;
}

/** Digits of the number with a +81/+1 country prefix normalised away. */
function normalizePhone(source: string): string {
  let digits = source.replace(/[^\d+]/g, "");
  if (digits.startsWith("+81")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("+1")) digits = digits.slice(2);
  else if (digits.startsWith("+")) digits = digits.slice(1);
  return digits;
}

const LINE_TYPE_WORDS: Record<Language, Record<"mobile" | "landline" | "tollFree", string>> = {
  ja: { mobile: "携帯", landline: "固定", tollFree: "フリーダイヤル" },
  en: { mobile: "Mobile", landline: "Landline", tollFree: "TollFree" },
};

export function phoneHint(
  source: string,
  granularity: "lineType" | "areaCode",
  language: Language,
): string | null {
  const digits = normalizePhone(source);
  if (granularity === "lineType") {
    // Line type is only meaningful for JP numbering (070/080/090 = mobile).
    if (!/^0\d{9,10}$/.test(digits)) return null;
    const words = LINE_TYPE_WORDS[language];
    if (/^0[789]0/.test(digits)) return words.mobile;
    if (/^0120/.test(digits)) return words.tollFree;
    return words.landline;
  }
  // Area code: take the part before the first separator in the original
  // notation (03-…, (333) …); fall back to known JP mobile/toll-free prefixes.
  const firstGroup = source.trim().match(/^(?:\+\d{1,2}[\s.-]?)?\(?(\d{2,4})[)\s.-]/);
  if (firstGroup) {
    let code = firstGroup[1]!;
    // "+81 90-…" is written without the leading 0; restore it (090).
    if (!code.startsWith("0") && digits.startsWith(`0${code}`)) code = `0${code}`;
    return code;
  }
  if (/^0[789]0/.test(digits)) return digits.slice(0, 3);
  if (/^0120/.test(digits)) return digits.slice(0, 4);
  return null;
}

const CJK = /[\u3040-\u30ff\u4e00-\u9fff]/;

/**
 * Group person names that appear to share a family name.
 * - Spaced names: 山田 太郎 -> first token; John Smith -> last token.
 * - Unspaced CJK names: pairwise common prefix of >= 2 chars that is shorter
 *   than both names (山田太郎 / 山田花子 -> group; 田中一郎 alone -> none).
 * Returns a group tag per name (同姓A / FamilyA) or null.
 */
export function personGroupHints(names: string[], language: Language): (string | null)[] {
  const surnameOf = (name: string): string | null => {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const key = CJK.test(name) ? parts[0]! : parts[parts.length - 1]!;
    return key.length >= 1 ? key : null;
  };

  const compact = names.map((n) => n.replace(/\s+/g, ""));
  const related = (i: number, j: number): boolean => {
    const a = surnameOf(names[i]!);
    const b = surnameOf(names[j]!);
    if (a !== null && b !== null) return a === b;
    // At least one unspaced name: only comparable for CJK scripts.
    if (!CJK.test(names[i]!) || !CJK.test(names[j]!)) return false;
    const x = a ?? compact[i]!;
    const y = b ?? compact[j]!;
    let common = 0;
    while (common < Math.min(x.length, y.length) && x[common] === y[common]) common++;
    if (a !== null || b !== null) {
      // Spaced side fixes the surname; the unspaced side must extend past it.
      const surname = (a ?? b)!;
      const other = a !== null ? y : x;
      return other.length > surname.length && other.startsWith(surname);
    }
    return common >= 2 && common < x.length && common < y.length;
  };

  // Union-find over the (small) name list.
  const parent = names.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (related(i, j)) parent[find(j)] = find(i);
    }
  }

  const groupSize = new Map<number, number>();
  for (let i = 0; i < names.length; i++) {
    const root = find(i);
    groupSize.set(root, (groupSize.get(root) ?? 0) + 1);
  }
  const tagPrefix = language === "ja" ? "同姓" : "Family";
  const tagByRoot = new Map<number, string>();
  return names.map((_, i) => {
    const root = find(i);
    if ((groupSize.get(root) ?? 0) < 2) return null;
    if (!tagByRoot.has(root)) {
      const n = tagByRoot.size;
      const tag = n < 26 ? String.fromCharCode(65 + n) : String(n + 1);
      tagByRoot.set(root, tagPrefix + tag);
    }
    return tagByRoot.get(root)!;
  });
}

/** Hint must be safe inside `<name_N:hint>`: no whitespace, `<`, `>`, `:`. */
function sanitizeHint(hint: string | null): string | null {
  if (!hint) return null;
  const cleaned = hint.replace(/[\s<>:]/gu, "");
  return cleaned.length > 0 ? cleaned.slice(0, 32) : null;
}

/**
 * Compute hints for the unique (entityType, source) pairs in `items`.
 * Returned map is keyed `${entityType}\u0000${source}` to match labeling.
 */
export function buildHintMap(
  items: HintItem[],
  options: HintOptions,
  language: Language,
): Map<string, string> {
  const hints = new Map<string, string>();
  const keyOf = (item: HintItem) => `${item.entityType}\u0000${item.source}`;

  const unique = new Map<string, HintItem>();
  for (const item of items) {
    if (!unique.has(keyOf(item))) unique.set(keyOf(item), item);
  }

  const persons: HintItem[] = [];
  for (const item of unique.values()) {
    let hint: string | null = null;
    if (item.entityType === "LOCATION" && options.location && options.location !== "none") {
      hint = locationHint(item.source, options.location);
    } else if (item.entityType === "PHONE_NUMBER" && options.phone && options.phone !== "none") {
      hint = phoneHint(item.source, options.phone, language);
    } else if (item.entityType === "PERSON" && options.person === "sharedSurname") {
      persons.push(item);
    }
    const safe = sanitizeHint(hint);
    if (safe) hints.set(keyOf(item), safe);
  }

  if (persons.length > 0) {
    const tags = personGroupHints(
      persons.map((p) => p.source),
      language,
    );
    persons.forEach((item, i) => {
      const safe = sanitizeHint(tags[i] ?? null);
      if (safe) hints.set(keyOf(item), safe);
    });
  }

  return hints;
}
