import { describe, expect, it } from "vitest";
import { DETECT_FOLDS } from "../src/languages.js";
import { normalizeForDetect } from "../src/normalize.js";

describe("normalizeForDetect", () => {
  it("NFC-composes combining marks and maps offsets", () => {
    const original = "cafe\u0301 090-1234-5678";
    const view = normalizeForDetect(original, "en");
    expect(view.text).toContain("é");
    expect(view.text).not.toContain("\u0301");
    const phone = "090-1234-5678";
    const start = view.text.indexOf(phone);
    const end = start + phone.length;
    const [origStart, origEnd] = view.mapSpan(start, end);
    expect(original.slice(origStart, origEnd)).toBe(phone);
  });

  it("folds halfwidth katakana for ja, including voicing marks", () => {
    const original = "ﾔﾏﾀﾞ ﾀﾛｳ";
    const view = normalizeForDetect(original, "ja");
    expect(view.text).toBe("ヤマダ タロウ");
    const [start, end] = view.mapSpan(0, view.text.length);
    expect(original.slice(start, end)).toBe(original);
  });

  it("maps phone spans past halfwidth names back to the original", () => {
    const original = "担当のﾔﾏﾀﾞです。090-1234-5678";
    const view = normalizeForDetect(original, "ja");
    expect(view.text).toContain("ヤマダ");
    const phone = "090-1234-5678";
    const start = view.text.indexOf(phone);
    const end = start + phone.length;
    const [mapped] = view.mapSpans([
      { start, end, entityType: "PHONE_NUMBER", score: 0.9 },
    ]);
    expect(original.slice(mapped!.start, mapped!.end)).toBe(phone);
  });

  it("does not fold halfwidth katakana for en", () => {
    expect(normalizeForDetect("ｶﾀｶﾅ", "en").text).toBe("ｶﾀｶﾅ");
  });

  it("registers the ja halfwidth fold in the language registry", () => {
    expect(DETECT_FOLDS.ja).toEqual(["halfwidth_katakana"]);
    expect(DETECT_FOLDS.en).toBeUndefined();
  });
});
