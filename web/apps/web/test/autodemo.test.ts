/**
 * jsdom test for the on-load auto demo: the sample for the selected language
 * is filled into the input and anonymized without any click. `?ner=0` keeps
 * the run offline (regex-only); the NER path is covered by the e2e suite.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  window.history.replaceState(null, "", "/?lang=ja&ner=0");
  await import("../src/main.ts");
});

describe("web app auto demo (jsdom, NER off)", () => {
  it("fills the JA sample and anonymizes it on load", async () => {
    const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

    // The Load sample button is gone; the demo runs by itself.
    expect(document.querySelector("#load-sample")).toBeNull();
    expect($<HTMLSelectElement>("#language").value).toBe("ja");
    expect($<HTMLInputElement>("#use-ner").checked).toBe(false);
    expect($<HTMLTextAreaElement>("#input").value).toContain("090-1234-5678");

    await vi.waitFor(() => {
      expect($("#output").textContent).not.toBe("");
    });
    const anonymized = $("#output").textContent ?? "";
    expect(anonymized).toContain("<電話番号_1>");
    expect(anonymized).toContain("<メールアドレス_1>");
    expect(anonymized).not.toContain("090-1234-5678");
    expect(anonymized).not.toContain("taro.yamada@example.com");
    expect($("#mapping-table").hidden).toBe(false);
  });
});
