import type { AnonymizeResult, NerBackend } from "@prompt-anonymizer/core";
import type { PromptAnonymizerElement } from "@prompt-anonymizer/element";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { AnonymizerPanel } from "../src/panel.js";

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

describe("AnonymizerPanel", () => {
  it("mounts and renders the custom element with the shadow DOM panel", () => {
    const { root, unmount } = mountPanel();
    const el = getElement(root);

    expect(el).toBeTruthy();
    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot!.querySelector("textarea.input")).toBeTruthy();
    expect(el.shadowRoot!.querySelector("button.anonymize")).toBeTruthy();
    expect(el.shadowRoot!.querySelector("div.output")).toBeTruthy();
    expect(el.shadowRoot!.querySelector("table.mapping")).toBeTruthy();
    expect(el.shadowRoot!.querySelector("section.restore")).toBeTruthy();

    unmount();
  });

  it("anonymizes through the element and emits anonymize", async () => {
    const onAnonymize = vi.fn();
    const { root, unmount } = mountPanel({ language: "ja", onAnonymize });
    const shadow = getElement(root).shadowRoot!;
    const input = shadow.querySelector("textarea.input") as HTMLTextAreaElement;

    input.value = "連絡は 090-1234-5678 か taro@example.com まで";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    (shadow.querySelector("button.anonymize") as HTMLButtonElement).click();

    await vi.waitFor(() => {
      expect(onAnonymize).toHaveBeenCalled();
    });

    const result = onAnonymize.mock.calls[0]![0] as AnonymizeResult;
    expect(result.text).toContain("<電話番号_1>");
    expect(shadow.querySelector("div.output")!.textContent).toContain("<電話番号_1>");

    unmount();
  });

  it("forwards denyList to the element and masks denied strings", async () => {
    const onAnonymize = vi.fn();
    const { root, unmount } = mountPanel({
      language: "ja",
      denyList: ["ProjectX"],
      onAnonymize,
    });
    const el = getElement(root);

    expect(el.denyList).toEqual(["ProjectX"]);

    const shadow = el.shadowRoot!;
    const input = shadow.querySelector("textarea.input") as HTMLTextAreaElement;
    input.value = "ProjectX is confidential";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    (shadow.querySelector("button.anonymize") as HTMLButtonElement).click();

    await vi.waitFor(() => {
      expect(onAnonymize).toHaveBeenCalled();
    });

    const result = onAnonymize.mock.calls[0]![0] as AnonymizeResult;
    expect(result.text).toContain("<秘匿情報_1>");

    unmount();
  });

  it("emits error when ner detect rejects", async () => {
    const onError = vi.fn();
    const ner: NerBackend = {
      detect: () => Promise.reject(new Error("ner failed")),
    };
    const { root, unmount } = mountPanel({ language: "ja", ner, onError });
    const shadow = getElement(root).shadowRoot!;
    const input = shadow.querySelector("textarea.input") as HTMLTextAreaElement;

    input.value = "some text";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    (shadow.querySelector("button.anonymize") as HTMLButtonElement).click();

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });

    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
    expect((onError.mock.calls[0]![0] as Error).message).toBe("ner failed");

    unmount();
  });

  it("hides the restore section when showRestore is false", () => {
    const { root, unmount } = mountPanel({ showRestore: false });
    const shadow = getElement(root).shadowRoot!;

    expect(shadow.querySelector<HTMLElement>("section.restore")!.hidden).toBe(true);

    unmount();
  });

  it("keeps denyList in sync when the prop changes", async () => {
    const denyList = ref(["Alpha"]);
    const Wrapper = defineComponent({
      setup() {
        return () => h(AnonymizerPanel, { language: "ja", denyList: denyList.value });
      },
    });

    const root = document.createElement("div");
    document.body.appendChild(root);
    const app = createApp(Wrapper);
    app.mount(root);

    const el = getElement(root);
    expect(el.denyList).toEqual(["Alpha"]);

    denyList.value = ["Beta"];
    await nextTick();

    expect(el.denyList).toEqual(["Beta"]);

    app.unmount();
    root.remove();
  });
});
