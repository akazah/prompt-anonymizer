import { buildHintMap } from "./hints.js";
import type { HintOptions } from "./hints.js";
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
export { buildHintMap, locationHint, personGroupHints, phoneHint } from "./hints.js";
export type { HintItem, HintOptions } from "./hints.js";
export {
  InMemoryMappingStore,
  RestoreSession,
  findPlaceholders,
  restoreText,
} from "./session.js";
export type {
  AnonymizeCallOptions,
  AnonymizeEngine,
  MappingStore,
  RestoreReplacement,
  RestoreResult,
  RestoreSessionOptions,
} from "./session.js";
export { detectWithRegex, isValidMyNumber, myNumberCheckDigit } from "./recognizers.js";
export {
  DEFAULT_NER_MODELS,
  TransformersNerBackend,
  detectWebGpu,
  findSpan,
} from "./ner.js";
export type { NerDevice, NerProgress, TransformersNerOptions } from "./ner.js";

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

  async anonymize(
    text: string,
    options: { language: Language; hints?: HintOptions },
  ): Promise<AnonymizeResult> {
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
    const merged = mergeSpans(spans);
    let hintFor: ((entityType: string, source: string) => string | null) | undefined;
    if (options.hints) {
      const hintMap = buildHintMap(
        merged.map((s) => ({ entityType: s.entityType, source: text.slice(s.start, s.end) })),
        options.hints,
        language,
      );
      hintFor = (entityType, source) => hintMap.get(`${entityType}\u0000${source}`) ?? null;
    }
    const { text: anonymized, mapping } = applyLabels(text, spans, LABELS[language], hintFor);
    return { text: anonymized, mapping, entities: merged };
  }

  deanonymize(text: string, mapping: Record<string, string>): string {
    return deanonymizeText(text, mapping);
  }
}

export { deanonymizeText as deanonymize };
