/**
 * Vue 3 composable wrapping the core restore flow.
 *
 * `useAnonymizer` exposes the "anonymize -> send to LLM -> paste reply ->
 * restore original PII" use case for Vue apps and Pinia stores. It delegates
 * to `RestoreSession` from `@prompt-anonymizer/core`, so behaviour matches the
 * browser app, Chrome extension, and other targets that share the same ports.
 *
 * The mapping returned by `anonymize` and held in `mapping` is PII. This
 * package never logs it, sends it over the network, or persists it — the
 * default store is in-memory only. Custom `MappingStore` adapters must follow
 * the same rule.
 */

import { Anonymizer, RestoreSession } from "@prompt-anonymizer/core";
import type {
  AnonymizeEngine,
  AnonymizeResult,
  AnonymizerOptions,
  Language,
  MappingStore,
  RestoreResult,
} from "@prompt-anonymizer/core";
import { readonly, ref, type Ref } from "vue";

export interface UseAnonymizerOptions extends AnonymizerOptions {
  /** Custom engine; defaults to `new Anonymizer(options)`. */
  engine?: AnonymizeEngine;
  /** Where the label -> original mapping lives; defaults to `InMemoryMappingStore`. */
  store?: MappingStore;
}

export interface UseAnonymizerReturn {
  /** Anonymize `text` and remember the mapping for a later `restore()`. */
  anonymize: (text: string, options: { language: Language }) => Promise<AnonymizeResult>;
  /** Replace mask placeholders in an LLM reply with the original PII. */
  restore: (text: string) => Promise<RestoreResult>;
  /** Drop the stored mapping. */
  clear: () => Promise<void>;
  /** Current label -> original mapping (PII - render locally only), or null. */
  mapping: Readonly<Ref<Readonly<Record<string, string>> | null>>;
  /** True while an anonymize/restore/clear call is in flight. */
  busy: Readonly<Ref<boolean>>;
  /** Last error thrown by an operation, cleared on the next successful one. */
  error: Readonly<Ref<Error | null>>;
}

export function useAnonymizer(options: UseAnonymizerOptions = {}): UseAnonymizerReturn {
  const { engine, store, ner, denyList, allowList, scoreThreshold, entities } = options;
  const session = new RestoreSession({
    engine: engine ?? new Anonymizer({ ner, denyList, allowList, scoreThreshold, entities }),
    store,
  });

  const mapping = ref<Record<string, string> | null>(null);
  const busy = ref(false);
  const error = ref<Error | null>(null);

  void session.loadMapping().then((loaded) => {
    mapping.value = loaded;
  });

  const run = async <T>(operation: () => Promise<T>): Promise<T> => {
    busy.value = true;
    try {
      const result = await operation();
      error.value = null;
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = err;
      throw err;
    } finally {
      busy.value = false;
    }
  };

  const anonymize = async (
    text: string,
    anonymizeOptions: { language: Language },
  ): Promise<AnonymizeResult> =>
    run(async () => {
      const result = await session.anonymize(text, anonymizeOptions);
      mapping.value = result.mapping;
      return result;
    });

  const restore = async (text: string): Promise<RestoreResult> => run(() => session.restore(text));

  const clear = async (): Promise<void> =>
    run(async () => {
      await session.clear();
      mapping.value = null;
    });

  return {
    anonymize,
    restore,
    clear,
    mapping: readonly(mapping),
    busy: readonly(busy),
    error: readonly(error),
  };
}

export { AnonymizerPanel } from "./panel.js";
export type { AnonymizerPanelProps } from "./panel.js";
