import { LABELS, applyLabels, deanonymize as deanonymizeText, mergeSpans } from "./labeling.js";
import { FAMILY_NAME_FIRST } from "./languages.js";
import { normalizeForDetect } from "./normalize.js";
import { detectDenyList, detectWithRegex, propagateEntityValues } from "./recognizers.js";
import type {
  AnonymizeResult,
  AnonymizerOptions,
  EntitySpan,
  Language,
  NerBackend,
} from "./types.js";

export * from "./types.js";
export {
  AUTO_DISPLAY_NAME,
  DETECT_FOLDS,
  FAMILY_NAME_FIRST,
  LANGUAGE_DISPLAY_NAMES,
  LANGUAGE_LIST,
  SUPPORTED_LANGUAGES,
  isLanguage,
  isLanguageOption,
  languageFromBcp47,
  languagePickerEntries,
} from "./languages.js";
export type { DetectFold, LanguageOption } from "./languages.js";
export { normalizeForDetect } from "./normalize.js";
export type { DetectView } from "./normalize.js";
export { SAMPLES } from "./samples.js";
export { LABELS, applyLabels, mergeSpans, splitPersonName } from "./labeling.js";
export type { ApplyLabelsOptions, NamePart, NamePartSpan } from "./labeling.js";
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
  isValidIban,
  isValidMyNumber,
  isValidUsSsn,
  myNumberCheckDigit,
  propagateEntityValues,
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

// Mirror of src/prompt_anonymizer/core.py DEFAULT_ENTITIES / OPTIONAL_ENTITIES.
export const DEFAULT_ENTITIES: string[] = [
  "PERSON",
  "EMAIL_ADDRESS",
  "LOCATION",
  "PHONE_NUMBER",
  "JP_POSTAL_CODE",
  "JP_MY_NUMBER",
  "CREDIT_CARD",
];
export const OPTIONAL_ENTITIES: string[] = ["US_SSN", "IBAN_CODE"];

export class Anonymizer {
  private readonly ner?: NerBackend;
  private readonly entities: Set<string>;
  private readonly denyList: string[];
  private readonly allowList: string[];
  private readonly scoreThreshold: number;
  private readonly splitPersonNames: boolean;

  constructor(options: AnonymizerOptions = {}) {
    this.ner = options.ner;
    this.entities = new Set(options.entities ?? DEFAULT_ENTITIES);
    this.denyList = options.denyList ?? [];
    this.allowList = options.allowList ?? [];
    this.scoreThreshold = options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;
    this.splitPersonNames = options.splitPersonNames ?? false;
  }

  async anonymize(text: string, options: { language: Language }): Promise<AnonymizeResult> {
    const { language } = options;
    // Detection runs on an NFC (+ language-fold) view; spans are mapped
    // back so labels/mapping always use the original surface form.
    const view = normalizeForDetect(text, language);
    const regexSpans = view.mapSpans(
      detectWithRegex(view.text, language).filter((s) => this.entities.has(s.entityType)),
    );
    const denyNeedles = this.denyList.map((item) => normalizeForDetect(item, language).text);
    const denySpans = view.mapSpans(detectDenyList(view.text, denyNeedles));
    const structured: EntitySpan[] = [...regexSpans, ...denySpans];
    let spans = [...structured];
    if (this.ner) {
      // Structured recognizers (regex, deny list) win over NER on overlap:
      // e.g. NER may claim the local part of an email address as PERSON.
      const nerSpans = view.mapSpans(await this.ner.detect(view.text, language));
      spans.push(
        ...nerSpans
          .filter((n) => this.entities.has(n.entityType))
          .filter((n) => !structured.some((s) => n.start < s.end && s.start < n.end)),
      );
      // NER models can miss a repeat of a name they detected elsewhere in
      // the same text; an exact repeat of a detected value is the same PII.
      spans.push(...propagateEntityValues(text, spans));
    }
    spans = spans.filter(
      (s) =>
        s.score >= this.scoreThreshold &&
        !this.allowList.includes(text.slice(s.start, s.end)),
    );
    const { text: anonymized, mapping } = applyLabels(text, spans, LABELS[language], {
      splitPersonNames: this.splitPersonNames,
      familyNameFirst: FAMILY_NAME_FIRST[language],
    });
    return { text: anonymized, mapping, entities: mergeSpans(spans, text) };
  }

  deanonymize(text: string, mapping: Record<string, string>): string {
    return deanonymizeText(text, mapping);
  }
}

export { deanonymizeText as deanonymize };
