/**
 * Vue 3 panel component wrapping the `<prompt-anonymizer>` custom element.
 *
 * `AnonymizerPanel` embeds the ready-made anonymize → LLM → restore UI so Vue
 * apps get the same on-device flow as the browser app and extension without
 * re-implementing layout or wiring.
 *
 * The mapping surfaced by `anonymize` / `restore` events is PII. This package
 * never logs it, sends it over the network, or persists it — the element's
 * default store is in-memory only. Custom `MappingStore` adapters must follow
 * the same rule.
 */

import { definePromptAnonymizer } from "@prompt-anonymizer/element";
import type { PromptAnonymizerElement } from "@prompt-anonymizer/element";
import type {
  AnonymizeResult,
  Language,
  MappingStore,
  NerBackend,
  RestoreResult,
} from "@prompt-anonymizer/core";
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from "vue";

export interface AnonymizerPanelProps {
  language?: "auto" | Language;
  showRestore?: boolean;
  ner?: NerBackend;
  store?: MappingStore;
  denyList?: string[];
  allowList?: string[];
  scoreThreshold?: number;
}

let elementDefined = false;

function ensureElementDefined(): void {
  if (typeof window !== "undefined" && !elementDefined) {
    definePromptAnonymizer();
    elementDefined = true;
  }
}

export const AnonymizerPanel = defineComponent({
  name: "AnonymizerPanel",
  props: {
    language: {
      type: String as PropType<"auto" | Language>,
      default: "auto",
    },
    showRestore: {
      type: Boolean,
      default: true,
    },
    ner: {
      type: Object as PropType<NerBackend>,
      default: undefined,
    },
    store: {
      type: Object as PropType<MappingStore>,
      default: undefined,
    },
    denyList: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
    allowList: {
      type: Array as PropType<string[]>,
      default: undefined,
    },
    scoreThreshold: {
      type: Number,
      default: undefined,
    },
  },
  emits: {
    anonymize: (payload: AnonymizeResult) => payload instanceof Object,
    restore: (payload: RestoreResult) => payload instanceof Object,
    error: (payload: Error) => payload instanceof Error,
  },
  setup(props, { emit }) {
    ensureElementDefined();

    const elRef = ref<PromptAnonymizerElement | null>(null);

    const syncObjectProps = (el: PromptAnonymizerElement): void => {
      el.ner = props.ner;
      el.store = props.store;
      el.denyList = props.denyList;
      el.allowList = props.allowList;
      el.scoreThreshold = props.scoreThreshold;
    };

    watch(
      () =>
        [
          props.ner,
          props.store,
          props.denyList,
          props.allowList,
          props.scoreThreshold,
        ] as const,
      () => {
        const el = elRef.value;
        if (el) {
          syncObjectProps(el);
        }
      },
    );

    onMounted(() => {
      const el = elRef.value;
      if (!el) {
        return;
      }

      syncObjectProps(el);

      const onAnonymize = (event: Event): void => {
        emit("anonymize", (event as CustomEvent<AnonymizeResult>).detail);
      };
      const onRestore = (event: Event): void => {
        emit("restore", (event as CustomEvent<RestoreResult>).detail);
      };
      const onError = (event: Event): void => {
        emit("error", (event as CustomEvent<Error>).detail);
      };

      el.addEventListener("pa-anonymize", onAnonymize);
      el.addEventListener("pa-restore", onRestore);
      el.addEventListener("pa-error", onError);

      onBeforeUnmount(() => {
        el.removeEventListener("pa-anonymize", onAnonymize);
        el.removeEventListener("pa-restore", onRestore);
        el.removeEventListener("pa-error", onError);
      });
    });

    return () =>
      h("prompt-anonymizer", {
        ref: elRef,
        language: props.language,
        "show-restore": props.showRestore ? undefined : "false",
      });
  },
});
