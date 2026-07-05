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

  async anonymize(text: string, options: { language: Language }): Promise<AnonymizeResult> {
    const { language } = options;
    let spans: EntitySpan[] = [
      ...detectWithRegex(text, language),
      ...detectDenyList(text, this.denyList),
    ];
    if (this.ner) {
      spans.push(...(await this.ner.detect(text, language)));
    }
    spans = spans.filter(
      (s) =>
        s.score >= this.scoreThreshold &&
        !this.allowList.includes(text.slice(s.start, s.end)),
    );
    const { text: anonymized, mapping } = applyLabels(text, spans, LABELS[language]);
    return { text: anonymized, mapping, entities: mergeSpans(spans) };
  }

  deanonymize(text: string, mapping: Record<string, string>): string {
    return deanonymizeText(text, mapping);
  }
}

export { deanonymizeText as deanonymize };
