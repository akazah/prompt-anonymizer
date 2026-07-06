import { describe, expect, it, vi } from "vitest";
import {
  definePromptAnonymizer,
  PromptAnonymizerElement,
} from "../src/index.js";
import type { MappingStore, NerBackend } from "@prompt-anonymizer/core";

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

describe("definePromptAnonymizer", () => {
  it("is idempotent", () => {
    expect(() => {
      definePromptAnonymizer();
      definePromptAnonymizer();
    }).not.toThrow();
  });
});

describe("PromptAnonymizerElement", () => {
  it("anonymizes Japanese contact info and fires pa-anonymize", async () => {
    const el = createElement();
    const onAnonymize = vi.fn();
    el.addEventListener("pa-anonymize", (e) => onAnonymize((e as CustomEvent).detail));

    setInput(el, "連絡は 090-1234-5678 か taro@example.com まで");
    click(el, "button.anonymize");

    await vi.waitFor(() => {
      expect($(el, "div.output").textContent).toContain("<電話番号_1>");
    });
    expect($(el, "div.output").textContent).toContain("<メールアドレス_1>");
    expect(($(el, "table.mapping") as HTMLTableElement).hidden).toBe(false);

    const rows = el.shadowRoot!.querySelectorAll("table.mapping tbody tr");
    expect(rows.length).toBe(2);
    const originals = [...rows].map((r) => r.querySelector("td:last-child")!.textContent);
    expect(originals).toContain("090-1234-5678");
    expect(originals).toContain("taro@example.com");

    expect(onAnonymize).toHaveBeenCalledOnce();
    expect(el.result?.text).toContain("<電話番号_1>");
  });

  it('masks email with English labels when language="en"', async () => {
    const el = createElement({ language: "en" });
    setInput(el, "Mail john@example.com");
    click(el, "button.anonymize");

    await vi.waitFor(() => {
      expect($(el, "div.output").textContent).toContain("<Email_1>");
    });
  });

  it("round-trips restore after anonymize", async () => {
    const el = createElement();
    setInput(el, "連絡は 090-1234-5678 か taro@example.com まで");
    click(el, "button.anonymize");
    await vi.waitFor(() => expect(el.result).not.toBeNull());

    const onRestore = vi.fn();
    el.addEventListener("pa-restore", (e) => onRestore((e as CustomEvent).detail));

    setRestoreInput(el, "<電話番号_1> へ折り返します");
    click(el, "button.restore");

    await vi.waitFor(() => {
      expect($(el, "div.restore-output").textContent).toBe("090-1234-5678 へ折り返します");
    });
    expect(onRestore).toHaveBeenCalledOnce();
    expect(onRestore.mock.calls[0]![0].unresolved).toEqual([]);
    expect(($(el, "p.unresolved-warning") as HTMLParagraphElement).hidden).toBe(true);
  });

  it("shows unresolved labels when mapping is missing", async () => {
    const el = createElement();
    setInput(el, "hello");
    click(el, "button.anonymize");
    await vi.waitFor(() => expect(el.result).not.toBeNull());

    setRestoreInput(el, "Dear <人名_9>, thanks");
    click(el, "button.restore");

    await vi.waitFor(() => {
      expect(($(el, "p.unresolved-warning") as HTMLParagraphElement).hidden).toBe(false);
    });
    expect($(el, "p.unresolved-warning").textContent).toContain("<人名_9>");
  });

  it("masks NER-detected names when ner is set and toggles ner-warning", async () => {
    const el = createElement();
    expect(($(el, "p.ner-warning") as HTMLParagraphElement).hidden).toBe(false);

    const stubNer: NerBackend = {
      detect: async (text) => {
        const start = text.indexOf("山田太郎");
        if (start === -1) return [];
        return [{ start, end: start + 4, entityType: "PERSON", score: 0.99 }];
      },
    };
    el.ner = stubNer;
    expect(($(el, "p.ner-warning") as HTMLParagraphElement).hidden).toBe(true);

    setInput(el, "山田太郎に連絡");
    click(el, "button.anonymize");

    await vi.waitFor(() => {
      expect($(el, "div.output").textContent).toContain("<人名_1>");
    });

    el.ner = undefined;
    expect(($(el, "p.ner-warning") as HTMLParagraphElement).hidden).toBe(false);
  });

  it("fires pa-error and re-enables buttons when anonymize throws", async () => {
    const el = createElement();
    const failingNer: NerBackend = {
      detect: async () => {
        throw new Error("NER failed");
      },
    };
    el.ner = failingNer;

    const onError = vi.fn();
    el.addEventListener("pa-error", (e) => onError((e as CustomEvent).detail));

    setInput(el, "山田太郎");
    click(el, "button.anonymize");

    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(onError.mock.calls[0]![0].message).toBe("NER failed");
    expect(($(el, "button.anonymize") as HTMLButtonElement).disabled).toBe(false);
    expect(($(el, "button.restore") as HTMLButtonElement).disabled).toBe(false);
  });

  it('hides and shows restore section via show-restore attribute', () => {
    const el = createElement({ "show-restore": "false" });
    expect(($(el, "section.restore") as HTMLElement).hidden).toBe(true);

    el.showRestore = true;
    expect(($(el, "section.restore") as HTMLElement).hidden).toBe(false);
  });

  it("restores from an injected store without a prior anonymize", async () => {
    const backing = {
      mapping: { "<電話番号_1>": "090-1234-5678" } as Record<string, string> | null,
    };
    const store: MappingStore = {
      load: () => Promise.resolve(backing.mapping),
      save: (mapping) => {
        backing.mapping = mapping;
        return Promise.resolve();
      },
      clear: () => {
        backing.mapping = null;
        return Promise.resolve();
      },
    };

    const el = createElement();
    el.store = store;

    setRestoreInput(el, "<電話番号_1> へ折り返します");
    click(el, "button.restore");

    await vi.waitFor(() => {
      expect($(el, "div.restore-output").textContent).toBe("090-1234-5678 へ折り返します");
    });
  });
});
