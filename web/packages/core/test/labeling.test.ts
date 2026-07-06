import { describe, expect, it } from "vitest";
import { LABELS, applyLabels, deanonymize, mergeSpans } from "../src/labeling.js";
import type { EntitySpan } from "../src/types.js";

const span = (start: number, end: number, entityType: string, score = 0.9): EntitySpan => ({
  start,
  end,
  entityType,
  score,
});

describe("applyLabels", () => {
  it("replaces spans with numbered labels (parity with Python core)", () => {
    const text = "山田太郎の電話は090-1234-5678";
    const { text: result, mapping } = applyLabels(
      text,
      [span(0, 4, "PERSON"), span(8, 21, "PHONE_NUMBER", 0.8)],
      LABELS.ja,
    );
    expect(result).toBe("<人名_1>の電話は<電話番号_1>");
    expect(mapping).toEqual({
      "<人名_1>": "山田太郎",
      "<電話番号_1>": "090-1234-5678",
    });
  });

  it("gives the same source string the same label", () => {
    const text = "John met John and Jane";
    const { text: result, mapping } = applyLabels(
      text,
      [span(0, 4, "PERSON"), span(9, 13, "PERSON"), span(18, 22, "PERSON")],
      LABELS.en,
    );
    expect(result).toBe("<Name_1> met <Name_1> and <Name_2>");
    expect(mapping).toEqual({ "<Name_1>": "John", "<Name_2>": "Jane" });
  });

  it("numbers labels beyond 62 without breaking", () => {
    const names = Array.from({ length: 70 }, (_, i) => `Person${String(i).padStart(3, "0")}`);
    const text = names.join(" ");
    const spans: EntitySpan[] = [];
    let offset = 0;
    for (const name of names) {
      spans.push(span(offset, offset + name.length, "PERSON"));
      offset += name.length + 1;
    }
    const { text: result, mapping } = applyLabels(text, spans, LABELS.en);
    expect(result).toContain("<Name_63>");
    expect(result).toContain("<Name_70>");
    expect(Object.keys(mapping)).toHaveLength(70);
  });
});

describe("mergeSpans", () => {
  it("prefers the higher score on overlap, keeping the loser's remainder", () => {
    const merged = mergeSpans([span(0, 10, "PERSON", 0.5), span(5, 15, "LOCATION", 0.9)]);
    expect(merged).toEqual([span(0, 5, "PERSON", 0.5), span(5, 15, "LOCATION", 0.9)]);
  });

  it("drops a span fully covered by a kept span", () => {
    const merged = mergeSpans([span(0, 10, "LOCATION", 0.9), span(2, 8, "PERSON", 0.5)]);
    expect(merged).toEqual([span(0, 10, "LOCATION", 0.9)]);
  });

  it("keeps non-overlapping spans sorted by start", () => {
    const merged = mergeSpans([span(10, 14, "PERSON"), span(0, 4, "PERSON")]);
    expect(merged.map((s) => s.start)).toEqual([0, 10]);
  });

  it("splits a low-score span around a kept span", () => {
    const merged = mergeSpans([span(0, 20, "LOCATION", 0.5), span(8, 12, "JP_POSTAL_CODE", 1.0)]);
    expect(merged).toEqual([
      span(0, 8, "LOCATION", 0.5),
      span(8, 12, "JP_POSTAL_CODE", 1.0),
      span(12, 20, "LOCATION", 0.5),
    ]);
  });

  it("trims whitespace from remainder edges when text is given", () => {
    // NER span covers "〒539-6608 福井県鴨川市"; the postal recognizer wins
    // the overlap and the address remainder must not keep the separator.
    const text = "〒539-6608 福井県鴨川市";
    const merged = mergeSpans(
      [span(0, 15, "LOCATION", 0.85), span(0, 9, "JP_POSTAL_CODE", 1.0)],
      text,
    );
    expect(merged).toEqual([span(0, 9, "JP_POSTAL_CODE", 1.0), span(10, 15, "LOCATION", 0.85)]);
  });
});

describe("applyLabels with overlap remainders", () => {
  it("masks the remainder and round-trips", () => {
    const text = "〒539-6608 福井県鴨川市鍛冶ケ沢1丁目15番12号に送付。";
    const { text: anonymized, mapping } = applyLabels(
      text,
      [span(0, 26, "LOCATION", 0.85), span(0, 9, "JP_POSTAL_CODE", 1.0)],
      LABELS.ja,
    );
    expect(anonymized).not.toContain("福井県");
    expect(deanonymize(anonymized, mapping)).toBe(text);
  });
});

describe("deanonymize", () => {
  it("round-trips", () => {
    const text = "山田太郎の電話は090-1234-5678。山田太郎に連絡。";
    const { text: anonymized, mapping } = applyLabels(
      text,
      [span(0, 4, "PERSON"), span(8, 21, "PHONE_NUMBER"), span(22, 26, "PERSON")],
      LABELS.ja,
    );
    expect(deanonymize(anonymized, mapping)).toBe(text);
  });

  it("replaces longest labels first", () => {
    expect(
      deanonymize("<Name_11> and <Name_1>", { "<Name_1>": "John", "<Name_11>": "Jane" }),
    ).toBe("Jane and John");
  });
});
