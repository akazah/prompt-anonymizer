// @vitest-environment jsdom
/**
 * jsdom smoke test for the chrome extension side panel: regex-only
 * (NER off) anonymization with chrome.storage.session mapping storage.
 * P0 pin: mappings must live in chrome.storage.session only, never in
 * localStorage/sessionStorage.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

const INPUT_TEXT = "お名前は田中花子です。連絡先は 090-1234-5678、メールは taro@example.com です。";

// Stub chrome.storage.session with an in-memory object before importing sidepanel
const storageStub = {
  data: {} as Record<string, unknown>,
  listeners: [] as Array<(changes: Record<string, unknown>) => void>,

  get: async (key: string | string[]) => {
    if (typeof key === "string") {
      return { [key]: storageStub.data[key] };
    }
    const result: Record<string, unknown> = {};
    for (const k of key) {
      result[k] = storageStub.data[k];
    }
    return result;
  },

  set: async (items: Record<string, unknown>) => {
    Object.assign(storageStub.data, items);
    // Trigger onChanged listeners
    for (const listener of storageStub.listeners) {
      listener(items);
    }
  },

  remove: async (key: string | string[]) => {
    if (typeof key === "string") {
      delete storageStub.data[key];
    } else {
      for (const k of key) {
        delete storageStub.data[k];
      }
    }
  },

  onChanged: {
    addListener: (listener: (changes: Record<string, unknown>) => void) => {
      storageStub.listeners.push(listener);
    },
  },
};

beforeAll(async () => {
  // Stub globalThis.chrome before importing sidepanel.ts
  (globalThis as any).chrome = {
    storage: {
      session: storageStub,
    },
  };

  // Create the root DOM element that sidepanel.ts expects
  document.body.innerHTML = '<div id="panel"></div>';

  // Dynamically import the side panel module
  await import("../src/sidepanel.ts");
});

describe("extension side panel (jsdom, NER off, chrome.storage.session)", () => {
  it("anonymizes with regex-only and stores mapping in chrome.storage.session", async () => {
    const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

    // Set deterministic offline config: Japanese language, NER off
    $<HTMLSelectElement>("#language").value = "ja";
    const useNer = $<HTMLInputElement>("#use-ner");
    useNer.checked = false;
    useNer.dispatchEvent(new Event("change"));
    expect($("#ner-off-warning").hidden).toBe(false);

    // Input Japanese text with phone and email
    $<HTMLTextAreaElement>("#input").value = INPUT_TEXT;
    $("#anonymize").click();

    // Wait for output to appear
    await vi.waitFor(() => {
      expect($("#output").textContent).not.toBe("");
    });

    const anonymized = $("#output").textContent ?? "";

    // Assert originals are NOT in output
    expect(anonymized).not.toContain("090-1234-5678");
    expect(anonymized).not.toContain("taro@example.com");

    // Assert labels are present (regex finds phone & email)
    expect(anonymized).toContain("<電話番号_1>");
    expect(anonymized).toContain("<メールアドレス_1>");

    // Mapping table shows both labels
    const mappingRows = document.querySelectorAll("#mapping-table tbody tr");
    expect(mappingRows.length).toBe(2);
    expect($("#mapping-table").hidden).toBe(false);

    // P0 pin: mapping MUST be in chrome.storage.session stub, NOT in localStorage/sessionStorage
    const storedMapping = storageStub.data["mapping"] as Record<string, string> | undefined;
    expect(storedMapping).toBeDefined();
    expect(storedMapping).toHaveProperty("<電話番号_1>", "090-1234-5678");
    expect(storedMapping).toHaveProperty("<メールアドレス_1>", "taro@example.com");

    // Assert localStorage is empty (critical for privacy)
    expect(window.localStorage.length).toBe(0);
    // Assert sessionStorage is empty
    expect(window.sessionStorage.length).toBe(0);
  });

  it("restores anonymized text using chrome.storage.session mapping", async () => {
    const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

    // Switch to restore tab
    $("#tab-restore").click();
    expect($("#view-restore").classList.contains("hidden")).toBe(false);

    // Simulated LLM reply containing the labels from previous test
    const lLMReply =
      "お名前は田中花子です。連絡先は <電話番号_1>、メールは <メールアドレス_1> です。";
    $<HTMLTextAreaElement>("#restore-input").value = lLMReply;
    $("#restore").click();

    // Wait for restore output
    await vi.waitFor(() => {
      const output = $("#restore-output").textContent ?? "";
      expect(output).toBeTruthy();
    });

    const restored = $("#restore-output").textContent ?? "";
    // Should restore the original values
    expect(restored).toContain("090-1234-5678");
    expect(restored).toContain("taro@example.com");
    expect(restored).toContain("田中花子");
    // No unresolved labels (mapping was found)
    expect($("#restore-warning").hidden).toBe(true);
  });
});
