/**
 * Guards the language registry: every per-language map in the core must
 * cover exactly the registry's codes, so adding a language fails loudly
 * here instead of at runtime (see docs/ADDING_A_LANGUAGE.md).
 */

import { describe, expect, it } from "vitest";
import { LABELS } from "../src/labeling.js";
import {
  AUTO_DISPLAY_NAME,
  LANGUAGE_DISPLAY_NAMES,
  SUPPORTED_LANGUAGES,
  isLanguage,
  isLanguageOption,
  languageFromBcp47,
  languagePickerEntries,
} from "../src/languages.js";
import { DEFAULT_NER_MODELS } from "../src/ner.js";

describe("language registry", () => {
  it("has no duplicate codes", () => {
    expect(new Set(SUPPORTED_LANGUAGES).size).toBe(SUPPORTED_LANGUAGES.length);
  });

  it("LANGUAGE_DISPLAY_NAMES covers exactly the registry", () => {
    expect(Object.keys(LANGUAGE_DISPLAY_NAMES).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });

  it("LABELS covers exactly the registry", () => {
    expect(Object.keys(LABELS).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });

  it("DEFAULT_NER_MODELS covers exactly the registry", () => {
    expect(Object.keys(DEFAULT_NER_MODELS).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
  });

  it("isLanguage rejects unsupported codes", () => {
    expect(isLanguage("fr")).toBe(false);
  });

  it("isLanguageOption accepts the auto sentinel", () => {
    expect(isLanguageOption("auto")).toBe(true);
  });

  it("languageFromBcp47 maps regional tags and rejects unsupported ones", () => {
    expect(languageFromBcp47("es-MX")).toBe("es");
    expect(languageFromBcp47("JA")).toBe("ja");
    expect(languageFromBcp47("fr-FR")).toBeNull();
    expect(languageFromBcp47("")).toBeNull();
  });

  it("languagePickerEntries follows display order, auto first when requested", () => {
    expect(languagePickerEntries().map((e) => e.value)).toEqual([...SUPPORTED_LANGUAGES]);
    const withAuto = languagePickerEntries({ auto: true });
    expect(withAuto[0]).toEqual({ value: "auto", label: AUTO_DISPLAY_NAME });
    expect(withAuto.map((e) => e.value)).toEqual(["auto", ...SUPPORTED_LANGUAGES]);
  });
});
