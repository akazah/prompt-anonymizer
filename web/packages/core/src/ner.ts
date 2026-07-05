/**
 * transformers.js NER backend (WebGPU with automatic WASM fallback).
 *
 * The token-classification pipeline does not expose character offsets, so
 * grouped entities are aligned back to the source text with a
 * whitespace-tolerant progressive search.
 */

import { pipeline } from "@huggingface/transformers";
import type { EntitySpan, Language, NerBackend } from "./types.js";

export const DEFAULT_NER_MODELS: Record<Language, string> = {
  ja: "jiting/xlm-roberta-ner-japanese_onnx",
  en: "Xenova/bert-base-NER",
};

/** Model tag -> prompt-anonymizer entity type. Unlisted tags are ignored. */
const TAG_MAP: Record<string, string> = {
  PER: "PERSON",
  PERSON: "PERSON",
  LOC: "LOCATION",
  LOCATION: "LOCATION",
  GPE: "LOCATION",
};

export type NerDevice = "webgpu" | "wasm";

export interface NerProgress {
  status: string;
  file?: string;
  progress?: number;
}

export interface TransformersNerOptions {
  models?: Partial<Record<Language, string>>;
  device?: NerDevice | "auto";
  onProgress?: (progress: NerProgress) => void;
}

export async function detectWebGpu(): Promise<boolean> {
  try {
    const gpu = (globalThis.navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } })
      ?.gpu;
    if (!gpu) return false;
    return (await gpu.requestAdapter()) != null;
  } catch {
    return false;
  }
}

interface RawToken {
  entity: string;
  score: number;
  index: number;
  word: string;
}

interface TokenGroup {
  tag: string;
  words: string[];
  score: number;
  count: number;
}

function groupTokens(tokens: RawToken[]): TokenGroup[] {
  const groups: TokenGroup[] = [];
  let current: TokenGroup | null = null;
  let lastIndex = -2;

  for (const token of tokens) {
    const raw = token.entity;
    if (!raw || raw === "O") {
      current = null;
      continue;
    }
    const isBegin = raw.startsWith("B-");
    const tag = raw.replace(/^[BI]-/, "");
    const contiguous = token.index === lastIndex + 1;
    if (current && current.tag === tag && !isBegin && contiguous) {
      current.words.push(token.word);
      current.score += token.score;
      current.count += 1;
    } else {
      current = { tag, words: [token.word], score: token.score, count: 1 };
      groups.push(current);
    }
    lastIndex = token.index;
  }
  return groups;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Align a grouped entity back to the source text starting at `from`.
 * Tolerates tokenizer artifacts: "##" continuations (BERT), "▁" word
 * boundaries (SentencePiece) and flexible whitespace.
 */
export function findSpan(
  text: string,
  from: number,
  words: string[],
): { start: number; end: number } | null {
  const cleaned = words
    .join("")
    .replace(/##/g, "")
    .replace(/\u2581/g, " ")
    .trim();
  if (!cleaned) return null;
  const pattern = cleaned
    .split("")
    .map((ch) => (ch === " " ? "\\s+" : escapeRegExp(ch)))
    .join("\\s*");
  const re = new RegExp(pattern, "gu");
  re.lastIndex = from;
  const match = re.exec(text);
  if (!match) return null;
  return { start: match.index, end: match.index + match[0].length };
}

type Pipe = (text: string, options?: { ignore_labels?: string[] }) => Promise<RawToken[]>;

export class TransformersNerBackend implements NerBackend {
  private readonly models: Record<Language, string>;
  private readonly requestedDevice: NerDevice | "auto";
  private readonly onProgress?: (progress: NerProgress) => void;
  private readonly pipes = new Map<Language, Promise<Pipe>>();
  /** Device actually in use, resolved on first load. */
  device: NerDevice | null = null;

  constructor(options: TransformersNerOptions = {}) {
    this.models = { ...DEFAULT_NER_MODELS, ...options.models };
    this.requestedDevice = options.device ?? "auto";
    this.onProgress = options.onProgress;
  }

  private async resolveDevice(): Promise<NerDevice> {
    if (this.requestedDevice !== "auto") return this.requestedDevice;
    return (await detectWebGpu()) ? "webgpu" : "wasm";
  }

  private loadPipe(language: Language): Promise<Pipe> {
    let promise = this.pipes.get(language);
    if (!promise) {
      promise = (async () => {
        const device = await this.resolveDevice();
        this.device = device;
        // q8 requires @huggingface/transformers >= 4: v3's WebGPU EP mis-executed
        // DequantizeLinear on int8 models, silently dropping PERSON/LOCATION
        // detections (huggingface/transformers.js#1512).
        const pipe = await pipeline("token-classification", this.models[language], {
          device,
          dtype: "q8",
          progress_callback: this.onProgress as never,
        });
        return pipe as unknown as Pipe;
      })();
      this.pipes.set(language, promise);
    }
    return promise;
  }

  /** Eagerly download and initialize the model for `language`. */
  async warmup(language: Language): Promise<void> {
    await this.loadPipe(language);
  }

  async detect(text: string, language: Language): Promise<EntitySpan[]> {
    if (!text.trim()) return [];
    const pipe = await this.loadPipe(language);
    const tokens = await pipe(text, { ignore_labels: [] });
    const groups = groupTokens(tokens);

    const spans: EntitySpan[] = [];
    let cursor = 0;
    for (const group of groups) {
      const entityType = TAG_MAP[group.tag];
      if (!entityType) continue;
      const found = findSpan(text, cursor, group.words);
      if (!found) continue;
      spans.push({
        start: found.start,
        end: found.end,
        entityType,
        score: group.score / group.count,
      });
      cursor = found.end;
    }
    return spans;
  }
}
