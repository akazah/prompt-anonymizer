/**
 * jsdom flow test: anonymize (regex-only) → "Simulate an LLM reply" →
 * restore, all through the real DOM wiring in src/main.ts. The simulated
 * reply is generated from the live mapping, so restore must resolve every
 * label without warnings.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { t } from "../src/ui-i18n.js";

const INPUT_TEXT = "連絡先は 090-1234-5678、メールは taro@example.com です。";

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  window.history.replaceState(null, "", "/?lang=ja&ner=0&demo=0");
  await import("../src/main.ts");
});

describe("simulate LLM reply (jsdom, NER off)", () => {
  it("round-trips anonymize → simulated reply → restore with no warnings", async () => {
    const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

    const simulateBtn = $<HTMLButtonElement>("#simulate-reply");
    expect(simulateBtn.disabled).toBe(true);

    $<HTMLTextAreaElement>("#input").value = INPUT_TEXT;
    $("#anonymize").click();
    await vi.waitFor(() => {
      expect($("#output").textContent).not.toBe("");
    });

    expect(simulateBtn.disabled).toBe(false);

    // Pattern-only run surfaces the on-device engine badge.
    const badge = $("#engine-badge");
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toContain(t("ja", "enginePatterns"));

    simulateBtn.click();
    const reply = $<HTMLTextAreaElement>("#restore-input").value;
    expect(reply).not.toContain("{labels}");
    expect(reply).toContain("<電話番号_1>");
    expect(reply).toContain("<メールアドレス_1>");
    expect($("#grid").dataset.activeStep).toBe("restore");

    $("#restore").click();
    await vi.waitFor(() => {
      expect($("#restore-output").textContent).not.toBe("");
    });
    const restored = $("#restore-output").textContent ?? "";
    expect(restored).toContain("090-1234-5678");
    expect(restored).toContain("taro@example.com");
    expect(restored).not.toMatch(/<電話番号_1>|<メールアドレス_1>/);
    expect($("#restore-warning").hidden).toBe(true);
    expect($("#site-footer").classList.contains("pulse")).toBe(true);
  });
});
