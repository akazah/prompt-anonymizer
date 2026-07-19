/**
 * On-device language detection across the supported languages
 * (SUPPORTED_LANGUAGES in languages.ts).
 *
 * Prefers the browser's built-in LanguageDetector API (Chrome 138+,
 * https://developer.mozilla.org/docs/Web/API/LanguageDetector) — an
 * on-device expert model, so text never leaves the device — and falls back
 * to a script-range heuristic everywhere else (Safari/WebKit, Firefox,
 * Node, older Chrome). The built-in model is only used when it is already
 * downloaded: `detectLanguage` never triggers a model download itself.
 */

import { SUPPORTED_LANGUAGES, languageFromBcp47 } from "./languages.js";
import type { Language } from "./types.js";

/**
 * Ordered heuristic rules, evaluated top to bottom; no match means "en".
 * Script-scoped rules (kana, hangul, han) are reliable; the Latin-diacritic
 * rules are best-effort — languages sharing diacritics (fr/it/es/pt accents)
 * can be confused, which is acceptable for a fallback heuristic. Mirrors
 * DETECTION_RULES in the Python core (`src/prompt_anonymizer/languages.py`).
 */
const DETECTION_RULES: ReadonlyArray<readonly [Language, RegExp]> = [
  // Kana is uniquely Japanese; han without kana (checked next) counts as
  // Chinese — kanji-only Japanese fragments are the known blind spot.
  // Include halfwidth katakana (FF61-FF9F); fullwidth-only ranges miss
  // strings such as 「ｶﾀｶﾅﾉﾐ」.
  ["ja", /[\u3040-\u30ff\uff61-\uff9f]/],
  ["ko", /[\uac00-\ud7a3\u1100-\u11ff]/],
  ["zh", /[\u4e00-\u9fff]/],
  // Vietnamese-specific letters (also claims ă/â/ơ/ư before the Latin
  // rules below can).
  ["vi", /[ăâđơưĂÂĐƠƯ\u1ea0-\u1ef9]/],
  ["de", /[ßäöÄÖẞ]/],
  ["pt", /[ãõÃÕ]/],
  ["es", /[¿¡ñÑ]/],
  ["fr", /[œŒêîûëïçÇÊÎÛËÏ]/],
  ["it", /[èòìàùÈÒÌÀÙ]/],
  // Broad accented-vowel fallback: shared across Romance languages, mapped
  // to es (the most common case historically; fr/it usually match above).
  ["es", /[áéíóúüÁÉÍÓÚÜ]/],
];

/** Heuristic fallback when the built-in LanguageDetector is unavailable. */
export function guessLanguage(text: string): Language {
  for (const [language, markers] of DETECTION_RULES) {
    if (markers.test(text)) return language;
  }
  return "en";
}

interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
}

interface BuiltinLanguageDetector {
  detect(text: string): Promise<LanguageDetectionResult[]>;
}

interface LanguageDetectorStatic {
  availability(options?: { expectedInputLanguages?: string[] }): Promise<string>;
  create(options?: { expectedInputLanguages?: string[] }): Promise<BuiltinLanguageDetector>;
}

const EXPECTED = { expectedInputLanguages: [...SUPPORTED_LANGUAGES] };

let cachedDetector: Promise<BuiltinLanguageDetector | null> | null = null;

function builtinDetectorStatic(): LanguageDetectorStatic | null {
  const candidate = (globalThis as { LanguageDetector?: LanguageDetectorStatic }).LanguageDetector;
  return candidate && typeof candidate.availability === "function" ? candidate : null;
}

async function loadBuiltinDetector(): Promise<BuiltinLanguageDetector | null> {
  const LanguageDetector = builtinDetectorStatic();
  if (!LanguageDetector) return null;
  try {
    // Only use the model when it is already on the device; "downloadable"
    // would trigger a download (and may require user activation).
    if ((await LanguageDetector.availability(EXPECTED)) !== "available") return null;
    return await LanguageDetector.create(EXPECTED);
  } catch {
    return null;
  }
}

/** Reset the cached detector (for tests). */
export function resetLanguageDetector(): void {
  cachedDetector = null;
}

/**
 * Detect which supported language `text` is written in, fully on-device.
 * Uses Chrome's built-in LanguageDetector when available and already
 * downloaded; otherwise (or on any error) uses {@link guessLanguage}.
 */
export async function detectLanguage(text: string): Promise<Language> {
  const fallback = guessLanguage(text);
  if (!text.trim()) return fallback;
  cachedDetector ??= loadBuiltinDetector();
  const detector = await cachedDetector;
  if (!detector) return fallback;
  try {
    const results = await detector.detect(text);
    for (const result of results) {
      const language = languageFromBcp47(result.detectedLanguage);
      if (language) return language;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
