import { LABELS, applyLabels, deanonymize as deanonymizeText, mergeSpans } from "./labeling.js";
import { detectDenyList, detectWithRegex } from "./recognizers.js";
import type {
  AnonymizeResult,
  AnonymizerOptions,
  EntitySpan,
  Language,
  NerBackend,
} from "./types.js";

export * from "./types.js";
export { LABELS, applyLabels, mergeSpans } from "./labeling.js";
export {
  InMemoryMappingStore,
  RestoreSession,
  findPlaceholders,
  restoreText,
} from "./session.js";
export type {
  AnonymizeEngine,
  MappingStore,
  RestoreReplacement,
  RestoreResult,
  RestoreSessionOptions,
} from "./session.js";
export {
  detectWithRegex,
  isValidCreditCard,
  isValidMyNumber,
  myNumberCheckDigit,
} from "./recognizers.js";
export {
  DEFAULT_NER_MODELS,
  TransformersNerBackend,
  detectWebGpu,
  findSpan,
} from "./ner.js";
export type { NerDevice, NerProgress, TransformersNerOptions } from "./ner.js";
export { detectLanguage, guessLanguage, resetLanguageDetector } from "./language-detect.js";

const DEFAULT_SCORE_THRESHOLD = 0.4;

export class Anonymizer {
  private readonly ner?: NerBackend;
  private readonly denyList: string[];
  private readonly allowList: string[];
  private readonly scoreThreshold: number;

  constructor(options: AnonymizerOptions = {}) {
    this.ner = options.ner;
    this.denyList = options.denyList ?? [];
    this.allowList = options.allowList ?? [];
    this.scoreThreshold = options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;
  }

  async anonymize(text: string, options: { language: Language }): Promise<AnonymizeResult> {
    const { language } = options;
    const structured: EntitySpan[] = [
      ...detectWithRegex(text, language),
      ...detectDenyList(text, this.denyList),
    ];
    let spans = [...structured];
    if (this.ner) {
      // Structured recognizers (regex, deny list) win over NER on overlap:
      // e.g. NER may claim the local part of an email address as PERSON.
      const nerSpans = await this.ner.detect(text, language);
      spans.push(
        ...nerSpans.filter(
          (n) => !structured.some((s) => n.start < s.end && s.start < n.end),
        ),
      );
    }
    spans = spans.filter(
      (s) =>
        s.score >= this.scoreThreshold &&
        !this.allowList.includes(text.slice(s.start, s.end)),
    );
    const { text: anonymized, mapping } = applyLabels(text, spans, LABELS[language]);
    return { text: anonymized, mapping, entities: mergeSpans(spans, text) };
  }

  deanonymize(text: string, mapping: Record<string, string>): string {
    return deanonymizeText(text, mapping);
  }
}

export { deanonymizeText as deanonymize };
