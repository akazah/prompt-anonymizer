/**
 * jsdom test for on-load sample prefill: the sample for the selected language
 * is filled into the input, but anonymization waits for a button click.
 * `?ner=0` keeps the run offline (regex-only).
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  window.history.replaceState(null, "", "/?lang=ja&ner=0");
  await import("../src/main.ts");
});

describe("web app sample prefill (jsdom, NER off)", () => {
  it("prefills the JA sample and anonymizes only after click", async () => {
    const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

    expect(document.querySelector("#load-sample")).toBeNull();
    expect($<HTMLSelectElement>("#language").value).toBe("ja");
    expect($<HTMLInputElement>("#use-ner").checked).toBe(false);
    expect($<HTMLTextAreaElement>("#input").value).toContain("090-1234-5678");
    expect($("#output").textContent).toBe("");

    $("#anonymize").click();
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
