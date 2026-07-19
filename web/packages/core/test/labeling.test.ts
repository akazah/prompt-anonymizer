import { describe, expect, it } from "vitest";
import { LABELS, applyLabels, deanonymize, mergeSpans, splitPersonName } from "../src/labeling.js";
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

describe("splitPersonName", () => {
  it("splits given-name-first names (parity with Python core)", () => {
    expect(splitPersonName("John Smith", false)).toEqual([
      { part: "first", start: 0, end: 4 },
      { part: "last", start: 5, end: 10 },
    ]);
    expect(splitPersonName("John Michael Smith", false)).toEqual([
      { part: "first", start: 0, end: 4 },
      { part: "middle", start: 5, end: 12 },
      { part: "last", start: 13, end: 18 },
    ]);
  });

  it("splits family-name-first names", () => {
    expect(splitPersonName("山田 太郎", true)).toEqual([
      { part: "last", start: 0, end: 2 },
      { part: "first", start: 3, end: 5 },
    ]);
    expect(splitPersonName("Nguyễn Văn An", true)).toEqual([
      { part: "last", start: 0, end: 6 },
      { part: "middle", start: 7, end: 10 },
      { part: "first", start: 11, end: 13 },
    ]);
  });

  it("returns no parts for single tokens and unspaced CJK names", () => {
    expect(splitPersonName("John", false)).toEqual([]);
    expect(splitPersonName("山田太郎", true)).toEqual([]);
    expect(splitPersonName("  John  ", false)).toEqual([]);
  });

  it("attaches surname particles to the last name", () => {
    const source = "Vincent van Gogh";
    expect(splitPersonName(source, false)).toEqual([
      { part: "first", start: 0, end: 7 },
      { part: "last", start: 8, end: 16 },
    ]);
    expect(source.slice(8, 16)).toBe("van Gogh");
  });

  it("keeps consecutive middle tokens as one contiguous part", () => {
    expect(splitPersonName("John Ronald Reuel Tolkien", false)).toEqual([
      { part: "first", start: 0, end: 4 },
      { part: "middle", start: 5, end: 17 },
      { part: "last", start: 18, end: 25 },
    ]);
  });
});

describe("applyLabels with splitPersonNames", () => {
  it("labels name parts with a shared person index (parity with Python core)", () => {
    const text = "John Smith met Jane Doe.";
    const { text: result, mapping } = applyLabels(
      text,
      [span(0, 10, "PERSON"), span(15, 23, "PERSON")],
      LABELS.en,
      { splitPersonNames: true },
    );
    expect(result).toBe(
      "<Name_1_First_Name> <Name_1_Last_Name> met <Name_2_First_Name> <Name_2_Last_Name>.",
    );
    expect(mapping).toEqual({
      "<Name_1_First_Name>": "John",
      "<Name_1_Last_Name>": "Smith",
      "<Name_2_First_Name>": "Jane",
      "<Name_2_Last_Name>": "Doe",
    });
    expect(deanonymize(result, mapping)).toBe(text);
  });

  it("shares the person counter with unsplittable names (family-first ja)", () => {
    const text = "山田 太郎と佐藤花子が出席。";
    const { text: result, mapping } = applyLabels(
      text,
      [span(0, 5, "PERSON"), span(6, 10, "PERSON")],
      LABELS.ja,
      { splitPersonNames: true, familyNameFirst: true },
    );
    expect(result).toBe("<人名_1_姓> <人名_1_名>と<人名_2>が出席。");
    expect(mapping).toEqual({
      "<人名_1_姓>": "山田",
      "<人名_1_名>": "太郎",
      "<人名_2>": "佐藤花子",
    });
    expect(deanonymize(result, mapping)).toBe(text);
  });

  it("reuses a part label for a later single-token mention", () => {
    const text = "John Smith called. John will call again.";
    const { text: result, mapping } = applyLabels(
      text,
      [span(0, 10, "PERSON"), span(19, 23, "PERSON")],
      LABELS.en,
      { splitPersonNames: true },
    );
    expect(result).toBe(
      "<Name_1_First_Name> <Name_1_Last_Name> called. <Name_1_First_Name> will call again.",
    );
    expect(mapping).toEqual({ "<Name_1_First_Name>": "John", "<Name_1_Last_Name>": "Smith" });
    expect(deanonymize(result, mapping)).toBe(text);
  });

  it("gives a repeated full name the same person index", () => {
    const text = "John Smith and John Smith";
    const { text: result, mapping } = applyLabels(
      text,
      [span(0, 10, "PERSON"), span(15, 25, "PERSON")],
      LABELS.en,
      { splitPersonNames: true },
    );
    expect(result).toBe(
      "<Name_1_First_Name> <Name_1_Last_Name> and <Name_1_First_Name> <Name_1_Last_Name>",
    );
    expect(Object.keys(mapping)).toHaveLength(2);
    expect(deanonymize(result, mapping)).toBe(text);
  });

  it("keeps separate person indices when persons share a part value", () => {
    const text = "John Smith and John Doe";
    const { text: result, mapping } = applyLabels(
      text,
      [span(0, 10, "PERSON"), span(15, 23, "PERSON")],
      LABELS.en,
      { splitPersonNames: true },
    );
    expect(mapping["<Name_1_First_Name>"]).toBe("John");
    expect(mapping["<Name_2_First_Name>"]).toBe("John");
    expect(deanonymize(result, mapping)).toBe(text);
  });

  it("is unchanged when the option is off", () => {
    const text = "John Smith met Jane.";
    const { text: result, mapping } = applyLabels(
      text,
      [span(0, 10, "PERSON"), span(15, 19, "PERSON")],
      LABELS.en,
    );
    expect(result).toBe("<Name_1> met <Name_2>.");
    expect(mapping).toEqual({ "<Name_1>": "John Smith", "<Name_2>": "Jane" });
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

describe("LABELS parity", () => {
  it("es and vi share the same entity keys as en and ja", () => {
    const enKeys = Object.keys(LABELS.en).sort();
    expect(Object.keys(LABELS.es).sort()).toEqual(enKeys);
    expect(Object.keys(LABELS.vi).sort()).toEqual(enKeys);
    expect(Object.keys(LABELS.ja).sort()).toEqual(enKeys);
  });

  it("uses localized PERSON labels for es and vi", () => {
    expect(LABELS.es.PERSON).toBe("Nombre");
    expect(LABELS.vi.PERSON).toBe("Tên");
  });
});

describe("applyLabels with es and vi", () => {
  it("round-trips Spanish labels", () => {
    const text = "Llámame al 612 345 678 o escribe a maria@example.com";
    const { text: anonymized, mapping } = applyLabels(
      text,
      [span(12, 24, "PHONE_NUMBER"), span(38, 56, "EMAIL_ADDRESS")],
      LABELS.es,
    );
    expect(anonymized).toContain("<Teléfono_1>");
    expect(anonymized).toContain("<Correo_1>");
    expect(deanonymize(anonymized, mapping)).toBe(text);
  });

  it("round-trips Vietnamese labels", () => {
    const text = "Gọi cho tôi ở 0912 345 678";
    const { text: anonymized, mapping } = applyLabels(
      text,
      [span(14, 26, "PHONE_NUMBER")],
      LABELS.vi,
    );
    expect(anonymized).toBe("Gọi cho tôi ở <SốĐiệnThoại_1>");
    expect(deanonymize(anonymized, mapping)).toBe(text);
  });
});
