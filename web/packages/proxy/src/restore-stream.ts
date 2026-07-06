/**
 * Incremental label restoration for streaming LLM responses.
 *
 * Labels such as `<人名_1>` may arrive split across SSE chunks; this class
 * holds back a bounded suffix that could still grow into a placeholder
 * before calling core's `restoreText`. Mappings are never logged or
 * persisted — they live only for the lifetime of the restorer instance.
 */

import { restoreText } from "@prompt-anonymizer/core";

/** Max length of a complete placeholder: `<` + 64 + `_` + 6 + `>` */
const MAX_PREFIX_LEN = 73;

/** Complete placeholder token (bounded quantifiers — runs on untrusted text). */
const COMPLETE_PLACEHOLDER = /^<[^<>\s]{1,64}_\d{1,6}>$/;

/** Viable incomplete prefix that could still become a placeholder. */
const VIABLE_PREFIX = /^<[^<>\s]{0,64}(?:_\d{0,6})?>?$/;

function findHoldStart(buffer: string): number {
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (buffer[i] !== "<") continue;
    const tail = buffer.slice(i);
    if (tail.length > MAX_PREFIX_LEN) continue;
    if (COMPLETE_PLACEHOLDER.test(tail)) continue;
    if (VIABLE_PREFIX.test(tail)) return i;
  }
  return buffer.length;
}

export class StreamingRestorer {
  private pending = "";
  private readonly mapping: Record<string, string>;

  constructor(mapping: Record<string, string>) {
    this.mapping = mapping;
  }

  /** Feed a chunk; returns the restored text that is now safe to emit. */
  push(chunk: string): string {
    this.pending += chunk;
    const holdStart = findHoldStart(this.pending);
    if (holdStart >= this.pending.length) {
      const safe = this.pending;
      this.pending = "";
      return restoreText(safe, this.mapping).text;
    }
    const safe = this.pending.slice(0, holdStart);
    this.pending = this.pending.slice(holdStart);
    return restoreText(safe, this.mapping).text;
  }

  /** Emit whatever is still buffered (partial labels come out as-is). */
  flush(): string {
    const out = restoreText(this.pending, this.mapping).text;
    this.pending = "";
    return out;
  }
}
