import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NerBackend } from "@prompt-anonymizer/core";
import type { PromptAnonymizerElement } from "@prompt-anonymizer/element";
import { AnonymizerPanel } from "../src/index.js";

const JA_INPUT = "連絡は 090-1234-5678 か taro@example.com まで";

function host(container: HTMLElement): PromptAnonymizerElement {
  return container.querySelector("prompt-anonymizer") as PromptAnonymizerElement;
}

function shadow(container: HTMLElement): ShadowRoot {
  return host(container).shadowRoot!;
}

describe("AnonymizerPanel", () => {
  it("renders the custom element and shadow DOM panel", () => {
    const { container } = render(<AnonymizerPanel />);

    const el = host(container);
    expect(el).toBeTruthy();
    expect(shadow(container).querySelector("textarea.input")).toBeTruthy();
    expect(shadow(container).querySelector("button.anonymize")).toBeTruthy();
    expect(shadow(container).querySelector("div.output")).toBeTruthy();
    expect(shadow(container).querySelector("table.mapping")).toBeTruthy();
    expect(shadow(container).querySelector("select.language")).toBeTruthy();
  });

  it("anonymizes through the element and calls onAnonymize", async () => {
    const onAnonymize = vi.fn();
    const { container } = render(<AnonymizerPanel language="ja" onAnonymize={onAnonymize} />);

    const input = shadow(container).querySelector("textarea.input") as HTMLTextAreaElement;
    input.value = JA_INPUT;
    fireEvent.input(input);

    fireEvent.click(shadow(container).querySelector("button.anonymize") as HTMLButtonElement);

    await waitFor(() => {
      expect(onAnonymize).toHaveBeenCalled();
    });

    const result = onAnonymize.mock.calls[0]![0];
    expect(result.text).toContain("<電話番号_1>");
    expect(shadow(container).querySelector("div.output")!.textContent).toContain("<電話番号_1>");
  });

  it("forwards denyList and masks deny-listed strings", async () => {
    const denyList = ["ProjectX"];
    const onAnonymize = vi.fn();
    const { container } = render(
      <AnonymizerPanel language="ja" denyList={denyList} onAnonymize={onAnonymize} />,
    );

    await waitFor(() => {
      expect(host(container).denyList).toEqual(denyList);
    });

    const input = shadow(container).querySelector("textarea.input") as HTMLTextAreaElement;
    input.value = "ProjectX の連絡先";
    fireEvent.input(input);
    fireEvent.click(shadow(container).querySelector("button.anonymize") as HTMLButtonElement);

    await waitFor(() => {
      expect(onAnonymize).toHaveBeenCalled();
    });

    expect(onAnonymize.mock.calls[0]![0].text).toContain("<秘匿情報_1>");
    expect(shadow(container).querySelector("div.output")!.textContent).toContain("<秘匿情報_1>");
  });

  it("calls onError when ner detect rejects", async () => {
    const ner: NerBackend = {
      detect: () => Promise.reject(new Error("ner failed")),
    };
    const onError = vi.fn();
    const { container } = render(<AnonymizerPanel ner={ner} onError={onError} />);

    const input = shadow(container).querySelector("textarea.input") as HTMLTextAreaElement;
    input.value = "hello";
    fireEvent.input(input);
    fireEvent.click(shadow(container).querySelector("button.anonymize") as HTMLButtonElement);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "ner failed" }));
    });
  });

  it("hides the restore section when showRestore is false", () => {
    const { container } = render(<AnonymizerPanel showRestore={false} />);

    const el = host(container);
    expect(el.getAttribute("show-restore")).toBe("false");
    expect(shadow(container).querySelector<HTMLElement>("section.restore")!.hidden).toBe(true);
  });
});
