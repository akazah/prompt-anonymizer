/**
 * Golden-set anonymize → restore round trip through the web component
 * (jsdom). Parity with web/e2e golden roundtrip, offline / regex-only.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  definePromptAnonymizer,
  PromptAnonymizerElement,
} from "../src/index.js";
import { GOLDEN_LANGUAGES, goldenSlice, mustBeMasked } from "./golden-slice.js";

function $(el: PromptAnonymizerElement, selector: string): HTMLElement {
  return el.shadowRoot!.querySelector(selector)!;
}

function createElement(attrs?: Record<string, string>): PromptAnonymizerElement {
  definePromptAnonymizer();
  const el = document.createElement("prompt-anonymizer") as PromptAnonymizerElement;
  if (attrs) {
    for (const [name, value] of Object.entries(attrs)) {
      el.setAttribute(name, value);
    }
  }
  document.body.appendChild(el);
  return el;
}

function setInput(el: PromptAnonymizerElement, text: string): void {
  const textarea = $(el, "textarea.input") as HTMLTextAreaElement;
  textarea.value = text;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function setRestoreInput(el: PromptAnonymizerElement, text: string): void {
  const textarea = $(el, "textarea.restore-input") as HTMLTextAreaElement;
  textarea.value = text;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function click(el: PromptAnonymizerElement, selector: string): void {
  ($(el, selector) as HTMLButtonElement).click();
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("golden round trip (element)", () => {
  for (const language of GOLDEN_LANGUAGES) {
    it(`restores original text for ${language} golden slice`, async () => {
      for (const goldenCase of goldenSlice(language)) {
        const el = createElement({ language });
        setInput(el, goldenCase.text);
        click(el, "button.anonymize");

        await vi.waitFor(() => {
          expect($(el, "div.output").textContent).not.toBe("");
        });

        const anonymized = $(el, "div.output").textContent ?? "";
        for (const span of goldenCase.spans) {
          if (mustBeMasked(span)) {
            expect(anonymized, `${goldenCase.id}: ${span.entity_type} leaked`).not.toContain(
              span.value,
            );
          }
        }

        setRestoreInput(el, anonymized);
        click(el, "button.restore");

        await vi.waitFor(() => {
          expect($(el, "div.restore-output").textContent).toBe(goldenCase.text);
        });

        el.remove();
      }
    });
  }
});
