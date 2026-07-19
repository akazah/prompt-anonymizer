/**
 * Single source of truth for the language codes both cores support.
 *
 * To add a language, extend SUPPORTED_LANGUAGES and LANGUAGE_DISPLAY_NAMES
 * here; the type union, pickers, CLI validation and detection tags all
 * derive from this module. The cross-core parity tests in `test/` then
 * point at every remaining gap (labels, models, recognizers, golden sets).
 * Mirror of `src/prompt_anonymizer/languages.py`.
 */

/** Display order (used by language pickers). */
export const SUPPORTED_LANGUAGES = [
  "ja",
  "en",
  "es",
  "vi",
  "zh",
  "ko",
  "fr",
  "de",
  "pt",
  "it",
] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** A concrete language or the "auto" sentinel accepted by CLIs and UIs. */
export type LanguageOption = Language | "auto";

/** Native-script names for language pickers. */
export const LANGUAGE_DISPLAY_NAMES: Record<Language, string> = {
  ja: "日本語",
  en: "English",
  es: "Español",
  vi: "Tiếng Việt",
  zh: "中文",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  it: "Italiano",
};

/**
 * Native name order for the opt-in name-part splitting (`splitPersonNames`):
 * `true` when the family name is written first. Mirrors the
 * `family_name_first` flag on the Python core's `LanguageConfig`.
 */
export const FAMILY_NAME_FIRST: Record<Language, boolean> = {
  ja: true,
  en: false,
  es: false,
  vi: true,
  zh: true,
  ko: true,
  fr: false,
  de: false,
  pt: false,
  it: false,
};

export const AUTO_DISPLAY_NAME = "Auto / 自動判定";

/** "ja, en, es, vi" — for help text and error messages. */
export const LANGUAGE_LIST = SUPPORTED_LANGUAGES.join(", ");

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function isLanguageOption(value: unknown): value is LanguageOption {
  return value === "auto" || isLanguage(value);
}

/** Map a BCP 47 tag (e.g. "es-MX") to a supported language, if any. */
export function languageFromBcp47(tag: string): Language | null {
  const base = tag.toLowerCase().split("-")[0];
  return isLanguage(base) ? base : null;
}

/** Entries for building a language `<select>`; `auto` first when included. */
export function languagePickerEntries(options?: {
  auto?: boolean;
}): Array<{ value: LanguageOption; label: string }> {
  const entries: Array<{ value: LanguageOption; label: string }> = SUPPORTED_LANGUAGES.map(
    (language) => ({ value: language, label: LANGUAGE_DISPLAY_NAMES[language] }),
  );
  return options?.auto ? [{ value: "auto", label: AUTO_DISPLAY_NAME }, ...entries] : entries;
}
