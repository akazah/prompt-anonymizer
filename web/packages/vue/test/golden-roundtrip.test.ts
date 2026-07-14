/**
 * Golden-set round trip through Vue AnonymizerPanel (jsdom).
 * Reuses the element golden-slice helper.
 */

import type { PromptAnonymizerElement } from "@prompt-anonymizer/element";
import { createApp, h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnonymizerPanel } from "../src/panel.js";
import {
  GOLDEN_LANGUAGES,
  goldenSlice,
  mustBeMasked,
} from "../../element/test/golden-slice.js";

function mountPanel(
  props: Record<string, unknown> = {},
): { root: HTMLDivElement; unmount: () => void } {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(h(AnonymizerPanel, props));
  app.mount(root);
  return {
    root,
    unmount: () => {
      app.unmount();
      root.remove();
    },
  };
}

function getElement(root: HTMLElement): PromptAnonymizerElement {
  return root.querySelector("prompt-anonymizer") as PromptAnonymizerElement;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("golden round trip (vue panel)", () => {
  for (const language of GOLDEN_LANGUAGES) {
    it(`restores original text for ${language} golden slice`, async () => {
      for (const goldenCase of goldenSlice(language)) {
        const { root, unmount } = mountPanel({ language });
        const shadow = getElement(root).shadowRoot!;

        const input = shadow.querySelector("textarea.input") as HTMLTextAreaElement;
        input.value = goldenCase.text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        (shadow.querySelector("button.anonymize") as HTMLButtonElement).click();

        await vi.waitFor(() => {
          expect(shadow.querySelector("div.output")!.textContent).not.toBe("");
        });

        const anonymized = shadow.querySelector("div.output")!.textContent ?? "";
        for (const span of goldenCase.spans) {
          if (mustBeMasked(span)) {
            expect(anonymized, `${goldenCase.id}: ${span.entity_type} leaked`).not.toContain(
              span.value,
            );
          }
        }

        const restoreInput = shadow.querySelector(
          "textarea.restore-input",
        ) as HTMLTextAreaElement;
        restoreInput.value = anonymized;
        restoreInput.dispatchEvent(new Event("input", { bubbles: true }));
        (shadow.querySelector("button.restore") as HTMLButtonElement).click();

        await vi.waitFor(() => {
          expect(shadow.querySelector("div.restore-output")!.textContent).toBe(
            goldenCase.text,
          );
        });

        unmount();
      }
    });
  }
});
