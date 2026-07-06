/**
 * On-device language detection for choosing between "en", "ja", "es", and "vi".
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

const VIETNAMESE_MARKERS = /[ăâđơưĂÂĐƠƯ\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]/;
const SPANISH_MARKERS = /[¿¡ñÑáéíóúüÁÉÍÓÚÜ]/;

/**
 * Heuristic fallback when the built-in LanguageDetector is unavailable.
 *
 * Ordering: (a) kana/kanji → "ja"; (b) Vietnamese-specific letters → "vi";
 * (c) Spanish markers → "es"; (d) otherwise "en". Step (c) runs after (b)
 * because Vietnamese also uses acute/grave vowels; other Romance languages
 * may map to "es" — acceptable for a 4-way heuristic.
 */
export function guessLanguage(text: string): Language {
  if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(text)) return "ja";
  if (VIETNAMESE_MARKERS.test(text)) return "vi";
  if (SPANISH_MARKERS.test(text)) return "es";
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
 * Detect whether `text` is Japanese, English, Spanish, or Vietnamese, fully
 * on-device. Uses Chrome's built-in LanguageDetector when available and
 * already downloaded; otherwise (or on any error) uses {@link guessLanguage}.
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
