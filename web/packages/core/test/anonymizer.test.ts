import { describe, expect, it } from "vitest";
import { Anonymizer, DEFAULT_ENTITIES, OPTIONAL_ENTITIES } from "../src/index.js";
import type { EntitySpan, Language, NerBackend } from "../src/types.js";

/** Deterministic mock NER: marks configured strings wherever they occur. */
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

describe("Anonymizer", () => {
  it("combines regex and NER detections with consistent labels", async () => {
    const anonymizer = new Anonymizer({
      ner: new MockNer({ 山田太郎: "PERSON", 東京都中央区: "LOCATION" }),
    });
    const text =
      "山田太郎は東京都中央区に住んでいます。山田太郎の電話は090-1234-5678、メールはtaro@example.comです。";
    const result = await anonymizer.anonymize(text, { language: "ja" });

    expect(result.text).not.toContain("山田太郎");
    expect(result.text).not.toContain("090-1234-5678");
    expect(result.text).not.toContain("taro@example.com");
    expect(result.text.match(/<人名_1>/g)).toHaveLength(2);
    expect(anonymizer.deanonymize(result.text, result.mapping)).toBe(text);
  });

  it("respects allowList and denyList", async () => {
    const anonymizer = new Anonymizer({
      ner: new MockNer({ 山田太郎: "PERSON" }),
      denyList: ["プロジェクトX"],
      allowList: ["山田太郎"],
    });
    const result = await anonymizer.anonymize("山田太郎はプロジェクトXの担当です。", {
      language: "ja",
    });
    expect(result.text).toContain("山田太郎");
    expect(result.text).not.toContain("プロジェクトX");
    expect(result.text).toContain("<秘匿情報_1>");
  });

  it("prefers structured recognizers over NER on overlap", async () => {
    // NER often claims the local part of an email as a PERSON.
    const anonymizer = new Anonymizer({ ner: new MockNer({ "taro.yamada": "PERSON" }) });
    const result = await anonymizer.anonymize("メールは taro.yamada@example.com です", {
      language: "ja",
    });
    expect(result.text).toBe("メールは <メールアドレス_1> です");
    expect(result.mapping["<メールアドレス_1>"]).toBe("taro.yamada@example.com");
  });

  it("works without a NER backend (regex-only)", async () => {
    const anonymizer = new Anonymizer();
    const result = await anonymizer.anonymize("Call (333) 333-3333 or mail a@b.co", {
      language: "en",
    });
    expect(result.text).toBe("Call <Phone_1> or mail <Email_1>");
  });

  it("round-trips Spanish text regex-only", async () => {
    const anonymizer = new Anonymizer();
    const text = "Llámame al 612 345 678 o escribe a maria@example.com";
    const result = await anonymizer.anonymize(text, { language: "es" });
    expect(result.text).toContain("<Teléfono_1>");
    expect(result.text).toContain("<Correo_1>");
    expect(anonymizer.deanonymize(result.text, result.mapping)).toBe(text);
  });

  it("round-trips Vietnamese text regex-only", async () => {
    const anonymizer = new Anonymizer();
    const text = "Gọi cho tôi ở 0912 345 678";
    const result = await anonymizer.anonymize(text, { language: "vi" });
    expect(result.text).toContain("<SốĐiệnThoại_1>");
    expect(anonymizer.deanonymize(result.text, result.mapping)).toBe(text);
  });

  it("does not mask optional entities unless requested", async () => {
    const text = "SSN 856-45-6780 and IBAN DE89370400440532013000";
    const anonymizer = new Anonymizer();
    const result = await anonymizer.anonymize(text, { language: "en" });
    expect(result.text).toBe(text);
    expect(result.mapping).toEqual({});
  });

  it("masks optional entities when explicitly requested", async () => {
    const textEn = "SSN 856-45-6780 and IBAN DE89370400440532013000";
    const anonymizerEn = new Anonymizer({
      entities: [...DEFAULT_ENTITIES, ...OPTIONAL_ENTITIES],
    });
    const resultEn = await anonymizerEn.anonymize(textEn, { language: "en" });
    expect(resultEn.text).not.toContain("856-45-6780");
    expect(resultEn.text).not.toContain("DE89370400440532013000");
    expect(resultEn.text).toContain("<SSN_1>");
    expect(resultEn.text).toContain("<IBAN_1>");
    expect(anonymizerEn.deanonymize(resultEn.text, resultEn.mapping)).toBe(textEn);

    const textJa = "社会保障番号は856-45-6780、振込先はDE89370400440532013000です";
    const anonymizerJa = new Anonymizer({
      entities: [...DEFAULT_ENTITIES, ...OPTIONAL_ENTITIES],
    });
    const resultJa = await anonymizerJa.anonymize(textJa, { language: "ja" });
    expect(resultJa.text).not.toContain("856-45-6780");
    expect(resultJa.text).not.toContain("DE89370400440532013000");
    expect(resultJa.text).toContain("<社会保障番号_1>");
    expect(resultJa.text).toContain("<IBAN_1>");
    expect(anonymizerJa.deanonymize(resultJa.text, resultJa.mapping)).toBe(textJa);
  });

  it("filters NER spans to the requested entity set", async () => {
    const anonymizer = new Anonymizer({
      ner: new MockNer({ "Jane Doe": "PERSON" }),
      entities: ["EMAIL_ADDRESS"],
    });
    const result = await anonymizer.anonymize("Jane Doe wrote to a@b.co", { language: "en" });
    expect(result.text).toContain("Jane Doe");
    expect(result.text).toContain("<Email_1>");
  });
});
