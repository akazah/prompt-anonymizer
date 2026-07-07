import { afterEach, describe, expect, it } from "vitest";
import { detectLanguage, guessLanguage, resetLanguageDetector } from "../src/language-detect.js";

type G = typeof globalThis & { LanguageDetector?: unknown };

afterEach(() => {
  delete (globalThis as G).LanguageDetector;
  resetLanguageDetector();
});

describe("guessLanguage", () => {
  it("detects Japanese by script", () => {
    expect(guessLanguage("山田太郎の電話番号")).toBe("ja");
    expect(guessLanguage("カタカナのみ")).toBe("ja");
  });

  it("detects Vietnamese by diacritics", () => {
    expect(guessLanguage("Tôi tên là Nguyễn Văn An")).toBe("vi");
  });

  it("detects Spanish by markers", () => {
    expect(guessLanguage("Hola, ¿cómo estás?")).toBe("es");
    expect(guessLanguage("me llamo María")).toBe("es");
  });

  it("detects the six new languages by script or diacritics", () => {
    expect(guessLanguage("请给我打电话")).toBe("zh");
    expect(guessLanguage("전화해 주세요")).toBe("ko");
    expect(guessLanguage("größere Straße")).toBe("de");
    expect(guessLanguage("informação não recebida")).toBe("pt");
    expect(guessLanguage("ça marche, où êtes-vous ?")).toBe("fr");
    expect(guessLanguage("la città è però lontana")).toBe("it");
  });

  it("prefers kana over han and hangul over Latin", () => {
    expect(guessLanguage("山田さんは北京にいる")).toBe("ja");
    expect(guessLanguage("서울 kontakt")).toBe("ko");
  });

  it("defaults to English otherwise", () => {
    expect(guessLanguage("Hello John Smith")).toBe("en");
    expect(guessLanguage("12345")).toBe("en");
  });
});

describe("detectLanguage", () => {
  it("falls back to the heuristic without a built-in detector", async () => {
    expect(await detectLanguage("山田太郎です")).toBe("ja");
    expect(await detectLanguage("Hi, this is John")).toBe("en");
  });

  it("uses the built-in LanguageDetector when available", async () => {
    (globalThis as G).LanguageDetector = {
      availability: async () => "available",
      create: async () => ({
        detect: async () => [{ detectedLanguage: "ja", confidence: 0.99 }],
      }),
    };
    // No CJK characters, but the built-in model says Japanese (e.g. romaji).
    expect(await detectLanguage("Yamada Taro desu. Yoroshiku onegaishimasu.")).toBe("ja");
  });

  it("normalizes BCP 47 tags to base languages", async () => {
    (globalThis as G).LanguageDetector = {
      availability: async () => "available",
      create: async () => ({
        detect: async () => [
          { detectedLanguage: "und", confidence: 0.4 },
          { detectedLanguage: "en-US", confidence: 0.3 },
        ],
      }),
    };
    expect(await detectLanguage("some text")).toBe("en");
  });

  it("never triggers a model download", async () => {
    let created = false;
    (globalThis as G).LanguageDetector = {
      availability: async () => "downloadable",
      create: async () => {
        created = true;
        return { detect: async () => [] };
      },
    };
    expect(await detectLanguage("山田太郎です")).toBe("ja");
    expect(created).toBe(false);
  });

  it("falls back on detector errors", async () => {
    (globalThis as G).LanguageDetector = {
      availability: async () => "available",
      create: async () => ({
        detect: async () => {
          throw new Error("boom");
        },
      }),
    };
    expect(await detectLanguage("こんにちは")).toBe("ja");
  });
});
