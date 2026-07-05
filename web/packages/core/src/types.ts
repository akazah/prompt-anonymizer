export type Language = "en" | "ja";

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
  /** Strings to always mask (labelled CUSTOM). */
  denyList?: string[];
  /** Strings to never mask even when detected. */
  allowList?: string[];
  scoreThreshold?: number;
}
