/**
 * jsdom smoke test for the browser app: regex-only (NER off) anonymize →
 * restore round-trip through the real DOM wiring in src/main.ts. Runtime
 * behavior with the NER model is covered by the Playwright e2e suite; this
 * keeps a fast, offline gate on the app's DOM glue.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { t } from "../src/ui-i18n.js";

const INPUT_TEXT = "連絡先は 090-1234-5678、メールは taro@example.com です。";

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  // No auto-anonymize on load; tests use ?demo=0 to skip sample prefill.
  window.history.replaceState(null, "", "/?demo=0");
  await import("../src/main.ts");
});

describe("web app (jsdom, NER off)", () => {
  it("anonymizes and restores through the DOM", async () => {
    const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

    // Deterministic offline path: fixed language, NER checkbox off.
    const language = $<HTMLSelectElement>("#language");
    language.value = "ja";
    language.dispatchEvent(new Event("change"));
    const useNer = $<HTMLInputElement>("#use-ner");
    useNer.checked = false;
    useNer.dispatchEvent(new Event("change"));
    expect($("#ner-off-warning").hidden).toBe(false);

    $<HTMLTextAreaElement>("#input").value = INPUT_TEXT;
    $("#anonymize").click();

    await vi.waitFor(() => {
      expect($("#output").textContent).not.toBe("");
    });
    const anonymized = $("#output").textContent ?? "";
    expect(anonymized).not.toContain("090-1234-5678");
    expect(anonymized).not.toContain("taro@example.com");
    expect(anonymized).toContain("<電話番号_1>");
    expect(anonymized).toContain("<メールアドレス_1>");

    // Mapping table lists both labels with the original values (kept local).
    const mappingRows = document.querySelectorAll("#mapping-table tbody tr");
    expect(mappingRows.length).toBe(2);
    expect($("#mapping-table").hidden).toBe(false);

    expect($<HTMLButtonElement>("#open-restore").disabled).toBe(false);
    $("#open-restore").click();
    expect($<HTMLTextAreaElement>("#restore-input").value).toBe(anonymized);
    expect($("#grid").dataset.activeStep).toBe("restore");

    // Round-trip: run restore on the prefilled anonymized text.
    $("#restore").click();
    await vi.waitFor(() => {
      expect($("#restore-output").textContent).toBe(INPUT_TEXT);
    });
    expect($("#restore-warning").hidden).toBe(true);
  });

  it("shows chrome in only the selected language (no JP/EN mix)", () => {
    const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
    const language = $<HTMLSelectElement>("#language");

    language.value = "ja";
    language.dispatchEvent(new Event("change"));
    expect(document.documentElement.lang).toBe("ja");
    expect($("#anonymize .anonymize-long").textContent).toBe(t("ja", "anonymize"));
    expect($("#anonymize .anonymize-short-main").textContent).toBe(t("ja", "anonymizeShort"));
    expect($("[data-i18n='nerModel']").textContent).toBe(t("ja", "nerModel"));
    expect($(".toolbar-switches").textContent).not.toMatch(/Split name|First\/Last|姓名分割/i);
    expect($(".hero-summary").textContent).toContain(t("ja", "valuePitch"));
    expect($(".hero-summary").textContent).not.toMatch(/On-device|second pair/i);
    expect(document.querySelectorAll(".hero-summary [lang], #ner-off-warning [lang]").length).toBe(0);
    expect([...language.options].find((o) => o.value === "auto")?.textContent).toBe(
      t("ja", "auto"),
    );

    language.value = "en";
    language.dispatchEvent(new Event("change"));
    expect(document.documentElement.lang).toBe("en");
    expect($("#anonymize .anonymize-long").textContent).toBe(t("en", "anonymize"));
    expect($("[data-i18n='nerModel']").textContent).toBe(t("en", "nerModel"));
    expect($(".toolbar-switches").textContent).not.toMatch(/姓名分割|人名・場所|Split name/i);
    expect($(".hero-summary").textContent).toContain(t("en", "valuePitch"));
    expect($(".hero-summary").textContent).not.toMatch(/端末内|ダブルチェック/);
    expect([...language.options].find((o) => o.value === "auto")?.textContent).toBe("Auto");
  });
});
