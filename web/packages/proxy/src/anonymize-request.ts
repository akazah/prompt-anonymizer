/**
 * Request-scoped label consistency across multiple chat messages.
 *
 * Core's `Anonymizer.anonymize()` resets counters per call; this wrapper
 * merges mappings so the same original value always receives the same
 * global label within one proxied request. The combined mapping exists
 * only in memory for that request (or the capped event buffer when
 * `recordMappings` is enabled).
 */

import type { AnonymizeResult, Language } from "@prompt-anonymizer/core";

export interface AnonymizeEngine {
  anonymize(text: string, options: { language: Language }): Promise<AnonymizeResult>;
}

const LABEL_PATTERN = /^<([^<>\s]{1,64})_(\d{1,6})>$/;

/** Placeholder-shaped token (bounded quantifiers — runs on untrusted text). */
const PLACEHOLDER_TOKEN = /<[^<>\s]{1,64}_\d{1,6}>/gu;

function parseLabel(label: string): { prefix: string; index: number } | null {
  const match = LABEL_PATTERN.exec(label);
  if (!match) return null;
  return { prefix: match[1]!, index: Number.parseInt(match[2]!, 10) };
}

export class RequestAnonymizer {
  private readonly engine: AnonymizeEngine;
  private readonly language: Language;
  private readonly valueToLabel = new Map<string, string>();
  private readonly prefixCounters = new Map<string, number>();

  readonly mapping: Record<string, string> = {};
  readonly entityCounts: Record<string, number> = {};

  constructor(engine: AnonymizeEngine, language: Language) {
    this.engine = engine;
    this.language = language;
  }

  /** Anonymize one text; labels are consistent across all calls on this instance. */
  async anonymize(text: string): Promise<string> {
    const result = await this.engine.anonymize(text, { language: this.language });

    for (const entity of result.entities) {
      this.entityCounts[entity.entityType] = (this.entityCounts[entity.entityType] ?? 0) + 1;
    }

    const rewrites = new Map<string, string>();

    for (const [localLabel, original] of Object.entries(result.mapping)) {
      const parsed = parseLabel(localLabel);
      if (!parsed) continue;

      const lookupKey = `${parsed.prefix}\u0000${original}`;
      let globalLabel = this.valueToLabel.get(lookupKey);

      if (globalLabel === undefined) {
        const next = (this.prefixCounters.get(parsed.prefix) ?? 0) + 1;
        this.prefixCounters.set(parsed.prefix, next);
        globalLabel = `<${parsed.prefix}_${next}>`;
        this.valueToLabel.set(lookupKey, globalLabel);
        this.mapping[globalLabel] = original;
      }

      if (localLabel !== globalLabel) {
        rewrites.set(localLabel, globalLabel);
      }
    }

    if (rewrites.size === 0) return result.text;
    // Single pass over placeholder-shaped tokens: sequential split/join would
    // cascade when two labels swap indexes (<Email_1> -> <Email_2> and
    // <Email_2> -> <Email_1>), collapsing both onto one label.
    return result.text.replace(PLACEHOLDER_TOKEN, (token) => rewrites.get(token) ?? token);
  }
}
