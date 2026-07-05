/**
 * Target-agnostic restore layer (ports & adapters).
 *
 * `RestoreSession` implements the "anonymize -> send to LLM -> paste reply ->
 * restore original PII" use case once, so frontend targets (browser app,
 * Chrome extension, Tauri desktop) only differ in the adapters they inject:
 *
 * - `AnonymizeEngine` port: anything that can anonymize text (`Anonymizer`
 *   satisfies it structurally; apps can wrap engine-switching logic).
 * - `MappingStore` port: where the label -> original mapping lives between
 *   the anonymize and restore steps (in-memory by default; the extension
 *   injects a `chrome.storage.session` adapter).
 *
 * The mapping is PII. Store adapters must never send it over the network or
 * persist it beyond the user's session.
 */

import type { HintOptions } from "./hints.js";
import type { AnonymizeResult, Language } from "./types.js";

export interface AnonymizeCallOptions {
  language: Language;
  /** Optional placeholder hints (opt-in partial context; see `hints.ts`). */
  hints?: HintOptions;
}

/** Port: produces an `AnonymizeResult`. `Anonymizer` satisfies this. */
export interface AnonymizeEngine {
  anonymize(text: string, options: AnonymizeCallOptions): Promise<AnonymizeResult>;
}

/** Port: per-target persistence of the label -> original mapping. */
export interface MappingStore {
  /** Returns the stored mapping, or null when none has been saved. */
  load(): Promise<Record<string, string> | null>;
  save(mapping: Record<string, string>): Promise<void>;
  clear(): Promise<void>;
}

/** Default adapter: keeps the mapping in memory (browser app / Tauri). */
export class InMemoryMappingStore implements MappingStore {
  private mapping: Record<string, string> | null = null;

  load(): Promise<Record<string, string> | null> {
    return Promise.resolve(this.mapping ? { ...this.mapping } : null);
  }

  save(mapping: Record<string, string>): Promise<void> {
    this.mapping = { ...mapping };
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.mapping = null;
    return Promise.resolve();
  }
}

/**
 * Placeholder-shaped tokens such as `<人名_1>`, `<JP_POSTAL_CODE_2>`, or the
 * hinted form `<住所_1:東京都>`. Bounded quantifiers only — this runs on
 * untrusted LLM output.
 */
const PLACEHOLDER_PATTERN = /<[^<>\s:]{1,64}_\d{1,6}(?::[^<>\s:]{1,32})?>/gu;

/** Unique placeholder-shaped tokens in `text`, in order of first appearance. */
export function findPlaceholders(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    seen.add(match[0]);
  }
  return [...seen];
}

export interface RestoreReplacement {
  label: string;
  value: string;
  /** How many occurrences of `label` were replaced. */
  count: number;
}

export interface RestoreResult {
  /** Text with all known labels replaced by their original values. */
  text: string;
  /** Labels that were actually found and replaced. */
  replacements: RestoreReplacement[];
  /**
   * Placeholder-shaped tokens left in the output with no mapping entry —
   * e.g. the model invented `<人名_9>` or the mapping was lost. Surface these
   * to the user instead of silently returning half-restored text.
   */
  unresolved: string[];
}

/**
 * Replace labels with their originals and report what happened.
 * Same longest-first algorithm as `deanonymize`; `result.text` is identical
 * to `deanonymize(text, mapping)` (asserted in tests).
 */
export function restoreText(text: string, mapping: Record<string, string>): RestoreResult {
  const labels = Object.keys(mapping).sort((a, b) => b.length - a.length);
  let result = text;
  const replacements: RestoreReplacement[] = [];
  for (const label of labels) {
    const parts = result.split(label);
    if (parts.length > 1) {
      replacements.push({ label, value: mapping[label]!, count: parts.length - 1 });
      result = parts.join(mapping[label]!);
    }
  }
  const unresolved = findPlaceholders(result).filter((token) => !(token in mapping));
  return { text: result, replacements, unresolved };
}

export interface RestoreSessionOptions {
  engine: AnonymizeEngine;
  /** Defaults to `InMemoryMappingStore`. */
  store?: MappingStore;
}

/**
 * Application-layer service tying anonymize and restore together through the
 * `MappingStore` port, so no frontend re-implements this flow.
 */
export class RestoreSession {
  private readonly engine: AnonymizeEngine;
  private readonly store: MappingStore;

  constructor(options: RestoreSessionOptions) {
    this.engine = options.engine;
    this.store = options.store ?? new InMemoryMappingStore();
  }

  /** Anonymize and remember the mapping for a later `restore()`. */
  async anonymize(text: string, options: AnonymizeCallOptions): Promise<AnonymizeResult> {
    const result = await this.engine.anonymize(text, options);
    await this.store.save(result.mapping);
    return result;
  }

  /** Replace mask placeholders in an LLM reply with the original PII. */
  async restore(text: string): Promise<RestoreResult> {
    const mapping = (await this.store.load()) ?? {};
    return restoreText(text, mapping);
  }

  /** Current mapping, if any (e.g. to re-render the label table). */
  loadMapping(): Promise<Record<string, string> | null> {
    return this.store.load();
  }

  /** Drop the stored mapping. */
  clear(): Promise<void> {
    return this.store.clear();
  }
}
