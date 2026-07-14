/**
 * Golden-set round trip through <AnonymizerPanel /> (jsdom).
 * Reuses the element golden-slice helper.
 */

import { fireEvent, render, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PromptAnonymizerElement } from "@prompt-anonymizer/element";
import { AnonymizerPanel } from "../src/index.js";
import {
  GOLDEN_LANGUAGES,
  goldenSlice,
  mustBeMasked,
} from "../../element/test/golden-slice.js";

function host(container: HTMLElement): PromptAnonymizerElement {
  return container.querySelector("prompt-anonymizer") as PromptAnonymizerElement;
}

function shadow(container: HTMLElement): ShadowRoot {
  return host(container).shadowRoot!;
}

afterEach(() => {
  cleanup();
});

describe("golden round trip (react panel)", () => {
  for (const language of GOLDEN_LANGUAGES) {
    it(`restores original text for ${language} golden slice`, async () => {
      for (const goldenCase of goldenSlice(language)) {
        const { container, unmount } = render(
          <AnonymizerPanel language={language} />,
        );
        const root = shadow(container);

        const input = root.querySelector("textarea.input") as HTMLTextAreaElement;
        input.value = goldenCase.text;
        fireEvent.input(input);
        fireEvent.click(root.querySelector("button.anonymize") as HTMLButtonElement);

        await waitFor(() => {
          expect(root.querySelector("div.output")!.textContent).not.toBe("");
        });

        const anonymized = root.querySelector("div.output")!.textContent ?? "";
        for (const span of goldenCase.spans) {
          if (mustBeMasked(span)) {
            expect(anonymized, `${goldenCase.id}: ${span.entity_type} leaked`).not.toContain(
              span.value,
            );
          }
        }

        const restoreInput = root.querySelector(
          "textarea.restore-input",
        ) as HTMLTextAreaElement;
        restoreInput.value = anonymized;
        fireEvent.input(restoreInput);
        fireEvent.click(root.querySelector("button.restore") as HTMLButtonElement);

        await waitFor(() => {
          expect(root.querySelector("div.restore-output")!.textContent).toBe(
            goldenCase.text,
          );
        });

        unmount();
      }
    });
  }
});
