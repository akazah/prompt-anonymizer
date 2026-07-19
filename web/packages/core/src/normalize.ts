/**
 * Detection-only text normalization with original-offset mapping.
 *
 * Analyzers see a normalized view (NFC, plus language-specific folds such
 * as halfwidth katakana → fullwidth for `ja`). Spans are projected back
 * onto the original string before labeling. Mirrors
 * `src/prompt_anonymizer/normalize.py`.
 */

import { DETECT_FOLDS, type DetectFold } from "./languages.js";
import type { EntitySpan, Language } from "./types.js";

const HW_BASE: Record<string, string> = {
  "ｦ": "ヲ",
  "ｧ": "ァ",
  "ｨ": "ィ",
  "ｩ": "ゥ",
  "ｪ": "ェ",
  "ｫ": "ォ",
  "ｬ": "ャ",
  "ｭ": "ュ",
  "ｮ": "ョ",
  "ｯ": "ッ",
  "ｰ": "ー",
  "ｱ": "ア",
  "ｲ": "イ",
  "ｳ": "ウ",
  "ｴ": "エ",
  "ｵ": "オ",
  "ｶ": "カ",
  "ｷ": "キ",
  "ｸ": "ク",
  "ｹ": "ケ",
  "ｺ": "コ",
  "ｻ": "サ",
  "ｼ": "シ",
  "ｽ": "ス",
  "ｾ": "セ",
  "ｿ": "ソ",
  "ﾀ": "タ",
  "ﾁ": "チ",
  "ﾂ": "ツ",
  "ﾃ": "テ",
  "ﾄ": "ト",
  "ﾅ": "ナ",
  "ﾆ": "ニ",
  "ﾇ": "ヌ",
  "ﾈ": "ネ",
  "ﾉ": "ノ",
  "ﾊ": "ハ",
  "ﾋ": "ヒ",
  "ﾌ": "フ",
  "ﾍ": "ヘ",
  "ﾎ": "ホ",
  "ﾏ": "マ",
  "ﾐ": "ミ",
  "ﾑ": "ム",
  "ﾒ": "メ",
  "ﾓ": "モ",
  "ﾔ": "ヤ",
  "ﾕ": "ユ",
  "ﾖ": "ヨ",
  "ﾗ": "ラ",
  "ﾘ": "リ",
  "ﾙ": "ル",
  "ﾚ": "レ",
  "ﾛ": "ロ",
  "ﾜ": "ワ",
  "ﾝ": "ン",
};

const HW_PUNCT: Record<string, string> = {
  "｡": "。",
  "｢": "「",
  "｣": "」",
  "､": "、",
  "･": "・",
};

const HW_VOICED: Record<string, string> = {
  "カ": "ガ",
  "キ": "ギ",
  "ク": "グ",
  "ケ": "ゲ",
  "コ": "ゴ",
  "サ": "ザ",
  "シ": "ジ",
  "ス": "ズ",
  "セ": "ゼ",
  "ソ": "ゾ",
  "タ": "ダ",
  "チ": "ヂ",
  "ツ": "ヅ",
  "テ": "デ",
  "ト": "ド",
  "ハ": "バ",
  "ヒ": "ビ",
  "フ": "ブ",
  "ヘ": "ベ",
  "ホ": "ボ",
  "ウ": "ヴ",
};

const HW_SEMI_VOICED: Record<string, string> = {
  "ハ": "パ",
  "ヒ": "ピ",
  "フ": "プ",
  "ヘ": "ペ",
  "ホ": "ポ",
};

export interface DetectView {
  text: string;
  /** `origPos[i]` is the original offset for normalized offset `i`. */
  origPos: readonly number[];
  mapSpan(start: number, end: number): [number, number];
  mapSpans(spans: EntitySpan[]): EntitySpan[];
}

function combiningMark(ch: string): boolean {
  return /\p{M}/u.test(ch);
}

function nfcWithMap(text: string): { text: string; origPos: number[] } {
  const out: string[] = [];
  const origPos = [0];
  let i = 0;
  while (i < text.length) {
    let j = i + 1;
    while (j < text.length && combiningMark(text[j]!)) j += 1;
    const chunk = text.slice(i, j).normalize("NFC");
    for (let k = 0; k < chunk.length; k++) {
      out.push(chunk[k]!);
      origPos.push(k === chunk.length - 1 ? j : i);
    }
    i = j;
  }
  return { text: out.join(""), origPos };
}

function foldHalfwidthKatakana(text: string, origPos: number[]): { text: string; origPos: number[] } {
  const out: string[] = [];
  const newPos = [origPos[0]!];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    const base = HW_BASE[ch];
    if (base !== undefined) {
      const next = i + 1 < text.length ? text[i + 1]! : "";
      if (next === "ﾞ" && HW_VOICED[base] !== undefined) {
        out.push(HW_VOICED[base]!);
        newPos.push(origPos[i + 2]!);
        i += 2;
        continue;
      }
      if (next === "ﾟ" && HW_SEMI_VOICED[base] !== undefined) {
        out.push(HW_SEMI_VOICED[base]!);
        newPos.push(origPos[i + 2]!);
        i += 2;
        continue;
      }
      out.push(base);
      newPos.push(origPos[i + 1]!);
      i += 1;
      continue;
    }
    if (HW_PUNCT[ch] !== undefined) {
      out.push(HW_PUNCT[ch]!);
      newPos.push(origPos[i + 1]!);
      i += 1;
      continue;
    }
    if (ch === "ﾞ" || ch === "ﾟ") {
      out.push(ch === "ﾞ" ? "゛" : "゜");
      newPos.push(origPos[i + 1]!);
      i += 1;
      continue;
    }
    out.push(ch);
    newPos.push(origPos[i + 1]!);
    i += 1;
  }
  return { text: out.join(""), origPos: newPos };
}

function applyFold(
  name: DetectFold,
  text: string,
  origPos: number[],
): { text: string; origPos: number[] } {
  if (name === "halfwidth_katakana") return foldHalfwidthKatakana(text, origPos);
  throw new Error(`unknown detect fold: ${name}`);
}

function makeView(text: string, origPos: number[]): DetectView {
  return {
    text,
    origPos,
    mapSpan(start: number, end: number): [number, number] {
      if (start < 0 || end < start || end > text.length) {
        throw new Error(`span [${start}, ${end}) out of range for detect view`);
      }
      return [origPos[start]!, origPos[end]!];
    },
    mapSpans(spans: EntitySpan[]): EntitySpan[] {
      return spans.map((span) => {
        const [start, end] = this.mapSpan(span.start, span.end);
        return { ...span, start, end };
      });
    },
  };
}

/** Build the detection view for `text` in `language`. */
export function normalizeForDetect(text: string, language: Language = "en"): DetectView {
  let { text: normalized, origPos } = nfcWithMap(text);
  for (const fold of DETECT_FOLDS[language] ?? []) {
    ({ text: normalized, origPos } = applyFold(fold, normalized, origPos));
  }
  return makeView(normalized, origPos);
}
