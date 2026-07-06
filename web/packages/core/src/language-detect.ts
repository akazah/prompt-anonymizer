/**
 * On-device language detection for choosing between "ja" and "en".
 *
 * Prefers the browser's built-in LanguageDetector API (Chrome 138+,
 * https://developer.mozilla.org/docs/Web/API/LanguageDetector) — an
 * on-device expert model, so text never leaves the device — and falls back
 * to a script-range heuristic everywhere else (Safari/WebKit, Firefox,
 * Node, older Chrome). The built-in model is only used when it is already
 * downloaded: `detectLanguage` never triggers a model download itself.
 */

import type { Language } from "./types.js";

/** Heuristic fallback: any kana/kanji means Japanese. */
export function guessLanguage(text: string): Language {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(text) ? "ja" : "en";
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

const EXPECTED = { expectedInputLanguages: ["en", "ja"] };

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
 * Detect whether `text` is Japanese or English, fully on-device.
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
      const base = result.detectedLanguage.toLowerCase().split("-")[0];
      if (base === "ja") return "ja";
      if (base === "en") return "en";
    }
    return fallback;
  } catch {
    return fallback;
  }
}
