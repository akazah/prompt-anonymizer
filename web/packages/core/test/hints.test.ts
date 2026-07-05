import { describe, expect, it } from "vitest";
import { buildHintMap, locationHint, personGroupHints, phoneHint } from "../src/hints.js";
import { Anonymizer } from "../src/index.js";
import { deanonymize } from "../src/labeling.js";
import { findPlaceholders, restoreText } from "../src/session.js";
import type { EntitySpan, Language, NerBackend } from "../src/types.js";

class MockNer implements NerBackend {
  constructor(private readonly known: Record<string, string>) {}

  detect(text: string, _language: Language): Promise<EntitySpan[]> {
    const spans: EntitySpan[] = [];
    for (const [value, entityType] of Object.entries(this.known)) {
      let from = 0;
      for (;;) {
        const at = text.indexOf(value, from);
        if (at === -1) break;
        spans.push({ start: at, end: at + value.length, entityType, score: 0.95 });
        from = at + value.length;
      }
    }
    return Promise.resolve(spans);
  }
}

describe("locationHint", () => {
  it("extracts the prefecture", () => {
    expect(locationHint("東京都中央区銀座1-2-3", "prefecture")).toBe("東京都");
    expect(locationHint("北海道札幌市北区", "prefecture")).toBe("北海道");
    expect(locationHint("神奈川県横浜市西区", "prefecture")).toBe("神奈川県");
    expect(locationHint("京都府京都市", "prefecture")).toBe("京都府");
  });

  it("extracts prefecture + municipality", () => {
    expect(locationHint("東京都中央区銀座1-2-3", "municipality")).toBe("東京都中央区");
    expect(locationHint("神奈川県横浜市西区", "municipality")).toBe("神奈川県横浜市");
    expect(locationHint("市原市五井中央", "municipality")).toBe("市原市");
  });

  it("falls back to prefecture when no municipality is found", () => {
    expect(locationHint("東京都", "municipality")).toBe("東京都");
  });

  it("returns null for non-Japanese locations", () => {
    expect(locationHint("New York", "prefecture")).toBeNull();
    expect(locationHint("New York", "municipality")).toBeNull();
  });
});

describe("phoneHint", () => {
  it("classifies JP line types", () => {
    expect(phoneHint("090-1234-5678", "lineType", "ja")).toBe("携帯");
    expect(phoneHint("+81 90-1234-5678", "lineType", "ja")).toBe("携帯");
    expect(phoneHint("03-1234-5678", "lineType", "ja")).toBe("固定");
    expect(phoneHint("0120-123-456", "lineType", "ja")).toBe("フリーダイヤル");
    expect(phoneHint("090-1234-5678", "lineType", "en")).toBe("Mobile");
  });

  it("returns null line type for non-JP numbering", () => {
    expect(phoneHint("(333) 333-3333", "lineType", "en")).toBeNull();
  });

  it("extracts the area code / leading group", () => {
    expect(phoneHint("03-1234-5678", "areaCode", "ja")).toBe("03");
    expect(phoneHint("0123-45-6789", "areaCode", "ja")).toBe("0123");
    expect(phoneHint("090-1234-5678", "areaCode", "ja")).toBe("090");
    expect(phoneHint("+81 90-1234-5678", "areaCode", "ja")).toBe("090");
    expect(phoneHint("09012345678", "areaCode", "ja")).toBe("090");
    expect(phoneHint("(333) 333-3333", "areaCode", "en")).toBe("333");
  });
});

describe("personGroupHints", () => {
  it("groups unspaced CJK names sharing a >=2 char prefix", () => {
    expect(personGroupHints(["山田太郎", "山田花子", "田中一郎"], "ja")).toEqual([
      "同姓A",
      "同姓A",
      null,
    ]);
  });

  it("does not group on a single shared character", () => {
    expect(personGroupHints(["田中一郎", "田村次郎"], "ja")).toEqual([null, null]);
  });

  it("groups spaced CJK names by first token, mixed with unspaced", () => {
    expect(personGroupHints(["山田 太郎", "山田花子"], "ja")).toEqual(["同姓A", "同姓A"]);
  });

  it("groups English names by last token", () => {
    expect(personGroupHints(["John Smith", "Jane Smith", "Bob Jones", "Ann Jones"], "en")).toEqual(
      ["FamilyA", "FamilyA", "FamilyB", "FamilyB"],
    );
  });

  it("leaves unrelated names unhinted", () => {
    expect(personGroupHints(["John Smith", "Jane Doe"], "en")).toEqual([null, null]);
  });
});

describe("buildHintMap", () => {
  it("only hints the requested entity types", () => {
    const map = buildHintMap(
      [
        { entityType: "LOCATION", source: "東京都中央区" },
        { entityType: "PHONE_NUMBER", source: "090-1234-5678" },
      ],
      { location: "prefecture" },
      "ja",
    );
    expect(map.get("LOCATION\u0000東京都中央区")).toBe("東京都");
    expect(map.has("PHONE_NUMBER\u0000090-1234-5678")).toBe(false);
  });
});

describe("Anonymizer with hints", () => {
  const ner = new MockNer({
    山田太郎: "PERSON",
    山田花子: "PERSON",
    佐藤次郎: "PERSON",
    東京都中央区銀座1丁目: "LOCATION",
  });
  const text =
    "山田太郎と山田花子は東京都中央区銀座1丁目に住んでいます。佐藤次郎の電話は090-1234-5678です。";

  it("produces hinted labels that round-trip", async () => {
    const anonymizer = new Anonymizer({ ner });
    const result = await anonymizer.anonymize(text, {
      language: "ja",
      hints: { location: "prefecture", phone: "lineType", person: "sharedSurname" },
    });
    expect(result.text).toContain("<人名_1:同姓A>");
    expect(result.text).toContain("<人名_2:同姓A>");
    expect(result.text).toContain("<人名_3>"); // 佐藤次郎: unrelated, no hint
    expect(result.text).toContain("<住所_1:東京都>");
    expect(result.text).toContain("<電話番号_1:携帯>");
    expect(result.text).not.toContain("山田");
    expect(deanonymize(result.text, result.mapping)).toBe(text);
  });

  it("keeps the default label format when hints are off", async () => {
    const anonymizer = new Anonymizer({ ner });
    const result = await anonymizer.anonymize(text, { language: "ja" });
    expect(result.text).toContain("<人名_1>");
    expect(result.text).not.toContain(":");
  });

  it("hinted placeholders are found and restored by the session layer", async () => {
    const anonymizer = new Anonymizer({ ner });
    const result = await anonymizer.anonymize(text, {
      language: "ja",
      hints: { location: "municipality", phone: "areaCode", person: "sharedSurname" },
    });
    const reply = `${result.text}\n<人名_99:同姓Z>は不明です。`;
    expect(findPlaceholders(reply)).toContain("<住所_1:東京都中央区>");
    const restored = restoreText(reply, result.mapping);
    expect(restored.text).toContain("山田太郎");
    expect(restored.text).toContain("090-1234-5678");
    expect(restored.unresolved).toEqual(["<人名_99:同姓Z>"]);
  });
});
