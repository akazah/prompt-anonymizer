import type { Language } from "./languages.js";

export type { Language } from "./languages.js";

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
  /**
   * Label name parts of multi-token PERSON spans individually
   * (`<Name_1_First_Name>` / `<人名_1_姓>` …), sharing one person index per
   * full name. Off by default; the split is whitespace-based, so unspaced
   * names (e.g. `山田太郎`) keep a plain person label.
   */
  splitPersonNames?: boolean;
}
