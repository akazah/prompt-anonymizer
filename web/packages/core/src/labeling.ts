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
    PERSON_FIRST_NAME: "First_Name",
    PERSON_MIDDLE_NAME: "Middle_Name",
    PERSON_LAST_NAME: "Last_Name",
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
    PERSON_FIRST_NAME: "名",
    PERSON_MIDDLE_NAME: "ミドルネーム",
    PERSON_LAST_NAME: "姓",
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
  es: {
    PERSON: "Nombre",
    PERSON_FIRST_NAME: "Nombre",
    PERSON_MIDDLE_NAME: "SegundoNombre",
    PERSON_LAST_NAME: "Apellido",
    EMAIL_ADDRESS: "Correo",
    LOCATION: "Dirección",
    PHONE_NUMBER: "Teléfono",
    JP_POSTAL_CODE: "CódigoPostal",
    JP_MY_NUMBER: "MyNumber",
    CREDIT_CARD: "Tarjeta",
    US_SSN: "SSN",
    IBAN_CODE: "IBAN",
    CUSTOM: "Personalizado",
  },
  vi: {
    PERSON: "Tên",
    PERSON_FIRST_NAME: "Tên",
    PERSON_MIDDLE_NAME: "TênĐệm",
    PERSON_LAST_NAME: "Họ",
    EMAIL_ADDRESS: "Email",
    LOCATION: "ĐịaChỉ",
    PHONE_NUMBER: "SốĐiệnThoại",
    JP_POSTAL_CODE: "MãBưuĐiện",
    JP_MY_NUMBER: "MyNumber",
    CREDIT_CARD: "ThẻTínDụng",
    US_SSN: "SSN",
    IBAN_CODE: "IBAN",
    CUSTOM: "TùyChỉnh",
  },
  zh: {
    PERSON: "姓名",
    PERSON_FIRST_NAME: "名",
    PERSON_MIDDLE_NAME: "中间名",
    PERSON_LAST_NAME: "姓",
    EMAIL_ADDRESS: "电子邮箱",
    LOCATION: "地址",
    PHONE_NUMBER: "电话号码",
    JP_POSTAL_CODE: "邮政编码",
    JP_MY_NUMBER: "MyNumber",
    CREDIT_CARD: "信用卡",
    US_SSN: "SSN",
    IBAN_CODE: "IBAN",
    CUSTOM: "自定义",
  },
  ko: {
    PERSON: "이름",
    PERSON_FIRST_NAME: "이름",
    PERSON_MIDDLE_NAME: "중간이름",
    PERSON_LAST_NAME: "성",
    EMAIL_ADDRESS: "이메일",
    LOCATION: "주소",
    PHONE_NUMBER: "전화번호",
    JP_POSTAL_CODE: "우편번호",
    JP_MY_NUMBER: "MyNumber",
    CREDIT_CARD: "신용카드",
    US_SSN: "SSN",
    IBAN_CODE: "IBAN",
    CUSTOM: "사용자지정",
  },
  fr: {
    PERSON: "Nom",
    PERSON_FIRST_NAME: "Prénom",
    PERSON_MIDDLE_NAME: "DeuxièmePrénom",
    PERSON_LAST_NAME: "NomDeFamille",
    EMAIL_ADDRESS: "Email",
    LOCATION: "Adresse",
    PHONE_NUMBER: "Téléphone",
    JP_POSTAL_CODE: "CodePostal",
    JP_MY_NUMBER: "MyNumber",
    CREDIT_CARD: "CarteBancaire",
    US_SSN: "SSN",
    IBAN_CODE: "IBAN",
    CUSTOM: "Personnalisé",
  },
  de: {
    PERSON: "Name",
    PERSON_FIRST_NAME: "Vorname",
    PERSON_MIDDLE_NAME: "Zweitname",
    PERSON_LAST_NAME: "Nachname",
    EMAIL_ADDRESS: "EMail",
    LOCATION: "Adresse",
    PHONE_NUMBER: "Telefon",
    JP_POSTAL_CODE: "Postleitzahl",
    JP_MY_NUMBER: "MyNumber",
    CREDIT_CARD: "Kreditkarte",
    US_SSN: "SSN",
    IBAN_CODE: "IBAN",
    CUSTOM: "Benutzerdefiniert",
  },
  pt: {
    PERSON: "Nome",
    PERSON_FIRST_NAME: "PrimeiroNome",
    PERSON_MIDDLE_NAME: "NomeDoMeio",
    PERSON_LAST_NAME: "Sobrenome",
    EMAIL_ADDRESS: "Email",
    LOCATION: "Endereço",
    PHONE_NUMBER: "Telefone",
    JP_POSTAL_CODE: "CódigoPostal",
    JP_MY_NUMBER: "MyNumber",
    CREDIT_CARD: "CartãoDeCrédito",
    US_SSN: "SSN",
    IBAN_CODE: "IBAN",
    CUSTOM: "Personalizado",
  },
  it: {
    PERSON: "Nome",
    PERSON_FIRST_NAME: "Nome",
    PERSON_MIDDLE_NAME: "SecondoNome",
    PERSON_LAST_NAME: "Cognome",
    EMAIL_ADDRESS: "Email",
    LOCATION: "Indirizzo",
    PHONE_NUMBER: "Telefono",
    JP_POSTAL_CODE: "CodicePostale",
    JP_MY_NUMBER: "MyNumber",
    CREDIT_CARD: "CartaDiCredito",
    US_SSN: "SSN",
    IBAN_CODE: "IBAN",
    CUSTOM: "Personalizzato",
  },
};

// Whitespace trimmed from the edges of remainder segments. An explicit set
// (rather than String.trim / str.strip) so both cores behave identically.
const STRIP_CHARS = " \t\n\r\u3000";

export type NamePart = "first" | "middle" | "last";

// Label keys for the localized part words (see LABELS above).
const NAME_PART_KEYS: Record<NamePart, string> = {
  first: "PERSON_FIRST_NAME",
  middle: "PERSON_MIDDLE_NAME",
  last: "PERSON_LAST_NAME",
};

// Surname particles for given-name-first languages: a token from this set
// (compared lowercase) starts the family name, so "Vincent van Gogh" splits
// into first="Vincent", last="van Gogh" rather than a bogus middle name.
const SURNAME_PARTICLES = new Set([
  "al",
  "bin",
  "binti",
  "da",
  "das",
  "de",
  "degli",
  "del",
  "della",
  "den",
  "der",
  "di",
  "dos",
  "du",
  "el",
  "la",
  "le",
  "ten",
  "ter",
  "van",
  "von",
]);

export interface NamePartSpan {
  part: NamePart;
  /** Offsets relative to the PERSON source string. */
  start: number;
  end: number;
}

/**
 * Split a PERSON source string into name parts, when possible.
 *
 * Returns parts in text order, or an empty array when the name has fewer
 * than two whitespace-separated tokens (e.g. "山田太郎" — splitting unspaced
 * CJK names would require a name dictionary, so they keep a plain person
 * label). Consecutive middle tokens form one contiguous part so each part
 * label maps to exactly one value.
 *
 * `familyNameFirst` follows the language's native order (ja/zh/ko/vi:
 * family name first); given-name-first languages additionally attach
 * surname particles ("van", "de", ...) to the last name.
 * Mirrors `split_person_name` in the Python core.
 */
export function splitPersonName(source: string, familyNameFirst: boolean): NamePartSpan[] {
  const tokens: Array<[number, number]> = [];
  let cursor = 0;
  while (cursor < source.length) {
    if (STRIP_CHARS.includes(source[cursor]!)) {
      cursor++;
      continue;
    }
    let end = cursor;
    while (end < source.length && !STRIP_CHARS.includes(source[end]!)) end++;
    tokens.push([cursor, end]);
    cursor = end;
  }
  if (tokens.length < 2) return [];

  if (familyNameFirst) {
    const parts: NamePartSpan[] = [{ part: "last", start: tokens[0]![0], end: tokens[0]![1] }];
    const middle = tokens.slice(1, -1);
    if (middle.length > 0) {
      parts.push({ part: "middle", start: middle[0]![0], end: middle[middle.length - 1]![1] });
    }
    parts.push({ part: "first", start: tokens[tokens.length - 1]![0], end: tokens[tokens.length - 1]![1] });
    return parts;
  }

  let lastStart = tokens.length - 1;
  for (let i = 1; i < tokens.length - 1; i++) {
    if (SURNAME_PARTICLES.has(source.slice(tokens[i]![0], tokens[i]![1]).toLowerCase())) {
      lastStart = i;
      break;
    }
  }
  const parts: NamePartSpan[] = [{ part: "first", start: tokens[0]![0], end: tokens[0]![1] }];
  const middle = tokens.slice(1, lastStart);
  if (middle.length > 0) {
    parts.push({ part: "middle", start: middle[0]![0], end: middle[middle.length - 1]![1] });
  }
  parts.push({ part: "last", start: tokens[lastStart]![0], end: tokens[tokens.length - 1]![1] });
  return parts;
}

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

export interface ApplyLabelsOptions {
  /**
   * Label name parts of multi-token PERSON spans individually
   * (`<Name_1_First_Name>` / `<人名_1_姓>` …), sharing one person index per
   * unique full name; a later single-token PERSON span matching an
   * already-seen part value reuses that part's label, so
   * "John Smith … John" stays consistent.
   */
  splitPersonNames?: boolean;
  /** Native name order (ja/zh/ko/vi: family name first). */
  familyNameFirst?: boolean;
}

export function applyLabels(
  text: string,
  spans: EntitySpan[],
  labels: Record<string, string>,
  options: ApplyLabelsOptions = {},
): { text: string; mapping: Record<string, string> } {
  const merged = mergeSpans(spans, text);

  const labelBySource = new Map<string, string>();
  const counters = new Map<string, number>();
  const mapping: Record<string, string> = {};
  const personIndexBySource = new Map<string, number>();
  const partLabelByValue = new Map<string, string>();
  const replacements: Array<{ start: number; end: number; label: string }> = [];

  for (const span of merged) {
    const source = text.slice(span.start, span.end);
    if (options.splitPersonNames && span.entityType === "PERSON") {
      const parts = splitPersonName(source, options.familyNameFirst ?? false);
      if (parts.length > 0) {
        if (!personIndexBySource.has(source)) {
          const next = (counters.get(span.entityType) ?? 0) + 1;
          counters.set(span.entityType, next);
          personIndexBySource.set(source, next);
        }
        const index = personIndexBySource.get(source)!;
        const personWord = labels[span.entityType] ?? span.entityType;
        for (const { part, start, end } of parts) {
          const value = source.slice(start, end);
          const partWord = labels[NAME_PART_KEYS[part]] ?? NAME_PART_KEYS[part];
          const label = `<${personWord}_${index}_${partWord}>`;
          mapping[label] ??= value;
          if (!partLabelByValue.has(value)) partLabelByValue.set(value, label);
          replacements.push({ start: span.start + start, end: span.start + end, label });
        }
        continue;
      }
      const reused = partLabelByValue.get(source);
      if (reused !== undefined) {
        replacements.push({ start: span.start, end: span.end, label: reused });
        continue;
      }
    }
    const key = `${span.entityType}\u0000${source}`;
    if (!labelBySource.has(key)) {
      const next = (counters.get(span.entityType) ?? 0) + 1;
      counters.set(span.entityType, next);
      const labelName = labels[span.entityType] ?? span.entityType;
      const label = `<${labelName}_${next}>`;
      labelBySource.set(key, label);
      mapping[label] = source;
    }
    replacements.push({ start: span.start, end: span.end, label: labelBySource.get(key)! });
  }

  let result = text;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end, label } = replacements[i]!;
    result = result.slice(0, start) + label + result.slice(end);
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
