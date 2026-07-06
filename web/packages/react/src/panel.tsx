/**
 * Ready-made anonymize -> LLM -> restore panel as a `<prompt-anonymizer>`
 * custom element. The mapping produced on anonymize is PII — never log it,
 * send it over the network, or persist it beyond what your injected
 * `MappingStore` allows. The element's default store is in-memory only.
 */

import { definePromptAnonymizer, type PromptAnonymizerElement } from "@prompt-anonymizer/element";
import type {
  AnonymizeResult,
  Language,
  MappingStore,
  NerBackend,
  RestoreResult,
} from "@prompt-anonymizer/core";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactElement,
  type Ref,
} from "react";

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        "prompt-anonymizer": {
          language?: "auto" | import("@prompt-anonymizer/core").Language;
          /** Custom-element attribute: any string other than "false" shows the section. */
          "show-restore"?: string;
          className?: string;
          style?: import("react").CSSProperties;
          ref?: import("react").Ref<
            import("@prompt-anonymizer/element").PromptAnonymizerElement
          >;
        };
      }
    }
  }
}

export interface AnonymizerPanelProps {
  /** en, ja, es, vi, or on-device auto-detection (default). */
  language?: "auto" | Language;
  /** Hide the restore section (default: shown). */
  showRestore?: boolean;
  /** NER backend; without it only regex entities (emails, phones, …) are masked. */
  ner?: NerBackend;
  store?: MappingStore;
  denyList?: string[];
  allowList?: string[];
  scoreThreshold?: number;
  onAnonymize?: (result: AnonymizeResult) => void;
  onRestore?: (result: RestoreResult) => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: CSSProperties;
}

export function AnonymizerPanel({
  language = "auto",
  showRestore = true,
  ner,
  store,
  denyList,
  allowList,
  scoreThreshold,
  onAnonymize,
  onRestore,
  onError,
  className,
  style,
}: AnonymizerPanelProps): ReactElement {
  if (typeof window !== "undefined") {
    definePromptAnonymizer();
  }

  const ref = useRef<PromptAnonymizerElement>(null);

  const onAnonymizeRef = useRef(onAnonymize);
  onAnonymizeRef.current = onAnonymize;
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    el.ner = ner;
    el.store = store;
    el.denyList = denyList;
    el.allowList = allowList;
    el.scoreThreshold = scoreThreshold;
  }, [ner, store, denyList, allowList, scoreThreshold]);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const handleAnonymize = (event: Event): void => {
      onAnonymizeRef.current?.((event as CustomEvent<AnonymizeResult>).detail);
    };
    const handleRestore = (event: Event): void => {
      onRestoreRef.current?.((event as CustomEvent<RestoreResult>).detail);
    };
    const handleError = (event: Event): void => {
      onErrorRef.current?.((event as CustomEvent<Error>).detail);
    };

    el.addEventListener("pa-anonymize", handleAnonymize);
    el.addEventListener("pa-restore", handleRestore);
    el.addEventListener("pa-error", handleError);

    return () => {
      el.removeEventListener("pa-anonymize", handleAnonymize);
      el.removeEventListener("pa-restore", handleRestore);
      el.removeEventListener("pa-error", handleError);
    };
  }, []);

  return (
    <prompt-anonymizer
      ref={ref}
      className={className}
      style={style}
      language={language}
      // React removes boolean-false attributes on custom elements, which the
      // element would read as "shown" — pass the explicit string instead.
      show-restore={showRestore ? undefined : "false"}
    />
  );
}
