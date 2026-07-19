import { SUPPORTED_LANGUAGES } from "@prompt-anonymizer/core";
import { describe, expect, it } from "vitest";
import {
  UI_MESSAGE_KEYS,
  UI_STRINGS,
  assertUiCatalogComplete,
  resolveUiLanguage,
  restorePlaceholderFor,
  t,
} from "../src/ui-i18n.js";

describe("ui-i18n catalog", () => {
  it("covers every supported language with every key", () => {
    expect(Object.keys(UI_STRINGS).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
    expect(() => assertUiCatalogComplete()).not.toThrow();
  });

  it("resolveUiLanguage follows the select, then navigator, then en", () => {
    expect(resolveUiLanguage("ja")).toBe("ja");
    expect(resolveUiLanguage("auto", "es-MX")).toBe("es");
    expect(resolveUiLanguage("auto", "th-TH")).toBe("en");
  });

  it("restore placeholder uses the language's PERSON label only", () => {
    expect(restorePlaceholderFor("ja")).toContain("<人名_1>");
    expect(restorePlaceholderFor("ja")).not.toMatch(/Name_1|Nombre_1/);
    expect(restorePlaceholderFor("en")).toContain("<Name_1>");
    expect(restorePlaceholderFor("en")).not.toContain("人名");
  });

  it("Japanese and English catalogs do not embed the other language's chrome", () => {
    expect(t("ja", "valueOnDevice")).toMatch(/端末/);
    expect(t("ja", "valueOnDevice")).not.toMatch(/On-device|second pair/i);
    expect(t("en", "valueOnDevice")).toMatch(/On-device/i);
    expect(t("en", "valueOnDevice")).not.toMatch(/端末|ダブルチェック/);
    expect(t("ja", "auto")).toBe("自動判定");
    expect(t("en", "auto")).toBe("Auto");
    expect(UI_MESSAGE_KEYS).toContain("nerOffWarning");
  });
});
