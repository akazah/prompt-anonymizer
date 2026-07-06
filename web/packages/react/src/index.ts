/**
 * React hooks for the anonymize -> LLM -> restore flow.
 *
 * `useAnonymizer` wraps `RestoreSession` from `@prompt-anonymizer/core` so
 * React apps do not re-implement session wiring. The mapping returned by
 * anonymize is PII — never log it, send it over the network, or persist it
 * beyond what your injected `MappingStore` allows. The default store is
 * in-memory only.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Anonymizer,
  RestoreSession,
  type AnonymizeEngine,
  type MappingStore,
  type RestoreResult,
} from "@prompt-anonymizer/core";
import type { AnonymizeResult, AnonymizerOptions, Language } from "@prompt-anonymizer/core";

export interface UseAnonymizerOptions extends AnonymizerOptions {
  /** Custom engine; defaults to `new Anonymizer(options)`. */
  engine?: AnonymizeEngine;
  /** Where the label -> original mapping lives; defaults to `InMemoryMappingStore`. */
  store?: MappingStore;
}

export interface UseAnonymizerResult {
  /** Anonymize `text` and remember the mapping for a later `restore()`. */
  anonymize: (text: string, options: { language: Language }) => Promise<AnonymizeResult>;
  /** Replace mask placeholders in an LLM reply with the original PII. */
  restore: (text: string) => Promise<RestoreResult>;
  /** Drop the stored mapping. */
  clear: () => Promise<void>;
  /** Current label -> original mapping (PII - render locally only), or null. */
  mapping: Record<string, string> | null;
  /** True while an anonymize/restore/clear call is in flight. */
  busy: boolean;
  /** Last error thrown by an operation, cleared on the next successful one. */
  error: Error | null;
}

/**
 * Session-scoped anonymize/restore hook.
 *
 * Options are captured on the first render only; the underlying `RestoreSession`
 * is created once per hook instance and later option changes are ignored.
 */
export function useAnonymizer(options?: UseAnonymizerOptions): UseAnonymizerResult {
  const [session] = useState(() => {
    const opts = options ?? {};
    const { engine, store, ner, denyList, allowList, scoreThreshold } = opts;
    return new RestoreSession({
      engine: engine ?? new Anonymizer({ ner, denyList, allowList, scoreThreshold }),
      store,
    });
  });

  const [mapping, setMapping] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    void session.loadMapping().then((loaded) => {
      if (mounted) {
        setMapping(loaded);
      }
    });
    return () => {
      mounted = false;
    };
  }, [session]);

  const anonymize = useCallback(
    async (text: string, langOptions: { language: Language }): Promise<AnonymizeResult> => {
      setBusy(true);
      try {
        const result = await session.anonymize(text, langOptions);
        setMapping(result.mapping);
        setError(null);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [session],
  );

  const restore = useCallback(
    async (text: string): Promise<RestoreResult> => {
      setBusy(true);
      try {
        const result = await session.restore(text);
        setError(null);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [session],
  );

  const clear = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      await session.clear();
      setMapping(null);
      setError(null);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [session]);

  return { anonymize, restore, clear, mapping, busy, error };
}

export { AnonymizerPanel, type AnonymizerPanelProps } from "./panel.js";
