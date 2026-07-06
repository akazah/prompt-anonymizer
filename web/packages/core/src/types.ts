/**
 * Supported languages - the single source of truth for the TS core and every
 * downstream surface (CLI, proxy, UI packages). Adding a language means
 * adding it here plus a LABELS entry (labeling.ts), a NER model (ner.ts),
 * detection markers (language-detect.ts) and any language-scoped regex rules
 * (recognizers.ts) - mirroring the Python core's
 * `src/prompt_anonymizer/languages.py` registry.
 */
export const LANGUAGES = ["en", "ja", "es", "vi", "zh", "ko", "fr", "de", "pt", "it"] as const;

export type Language = (typeof LANGUAGES)[number];

/** Runtime guard for user-supplied language strings (CLI flags, API bodies,
 * UI attribute values). Prefer this over hand-written literal comparisons. */
export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/** Native display names, e.g. for UI language pickers. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  ja: "日本語",
  es: "Español",
  vi: "Tiếng Việt",
  zh: "中文",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  it: "Italiano",
};

export interface EntitySpan {
  start: number;
  end: number;
  entityType: string;
  score: number;
}

export interface AnonymizeResult {
  text: string;
  /** label -> original value. Never persisted by this library. */
  mapping: Record<string, string>;
  entities: EntitySpan[];
}

/** Pluggable NER backend (transformers.js in production, mock in tests). */
export interface NerBackend {
  detect(text: string, language: Language): Promise<EntitySpan[]>;
}

export interface AnonymizerOptions {
  ner?: NerBackend;
  /**
   * Entity types to detect. Defaults to DEFAULT_ENTITIES (parity with the
   * Python core). Optional entities (US_SSN, IBAN_CODE) must be requested
   * explicitly. Deny-list matches (CUSTOM) are always kept.
   */
  entities?: string[];
  /** Strings to always mask (labelled CUSTOM). */
  denyList?: string[];
  /** Strings to never mask even when detected. */
  allowList?: string[];
  scoreThreshold?: number;
}
