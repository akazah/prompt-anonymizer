import { describe, expect, it } from "vitest";
import {
  Anonymizer,
  deanonymize,
  type EntitySpan,
  type Language,
  type NerBackend,
} from "@prompt-anonymizer/core";
import { RequestAnonymizer } from "../src/anonymize-request.js";

const engine = new Anonymizer();

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

describe("RequestAnonymizer", () => {
  it("reuses the same label for the same value across messages", async () => {
    const ra = new RequestAnonymizer(engine, "en");
    const a = await ra.anonymize("Contact john@example.com");
    const b = await ra.anonymize("Again john@example.com please");
    expect(a).toContain("<Email_1>");
    expect(b).toContain("<Email_1>");
    expect(ra.mapping).toEqual({ "<Email_1>": "john@example.com" });
  });

  it("assigns _1, _2 for different values of the same type", async () => {
    const ra = new RequestAnonymizer(engine, "en");
    const a = await ra.anonymize("a@x.com");
    const b = await ra.anonymize("b@x.com");
    expect(a).toBe("<Email_1>");
    expect(b).toBe("<Email_2>");
    expect(ra.mapping).toEqual({
      "<Email_1>": "a@x.com",
      "<Email_2>": "b@x.com",
    });
  });

  it("round-trips via deanonymize on joined anonymized messages", async () => {
    const ra = new RequestAnonymizer(engine, "ja");
    const m1 = "連絡は taro@example.com";
    const m2 = "電話 090-1111-2222";
    const a1 = await ra.anonymize(m1);
    const a2 = await ra.anonymize(m2);
    const joined = `${a1}\n${a2}`;
    expect(deanonymize(joined, ra.mapping)).toBe(`${m1}\n${m2}`);
  });

  it("does not cascade rewrites when labels swap indexes across messages", async () => {
    // Message 1 fixes a@x.com = <Email_1>. Message 2 locally assigns
    // b@x.com = <Email_1> and a@x.com = <Email_2>, so the rewrites are the
    // swap <Email_1> -> <Email_2>, <Email_2> -> <Email_1>; sequential
    // replacement would collapse both onto <Email_1>.
    const ra = new RequestAnonymizer(engine, "en");
    await ra.anonymize("a@x.com");
    const second = await ra.anonymize("b@x.com then a@x.com");
    expect(second).toBe("<Email_2> then <Email_1>");
    expect(ra.mapping).toEqual({
      "<Email_1>": "a@x.com",
      "<Email_2>": "b@x.com",
    });
    expect(deanonymize(second, ra.mapping)).toBe("b@x.com then a@x.com");
  });

  it("accumulates entityCounts across calls", async () => {
    const ra = new RequestAnonymizer(engine, "en");
    await ra.anonymize("a@x.com and b@y.com");
    await ra.anonymize("c@z.com");
    expect(ra.entityCounts.EMAIL_ADDRESS).toBe(3);
  });

  it("renumbers name-part labels per person group across messages", async () => {
    const splitEngine = new Anonymizer({
      ner: new MockNer({ "John Smith": "PERSON", "Jane Doe": "PERSON" }),
      splitPersonNames: true,
    });
    const ra = new RequestAnonymizer(splitEngine, "en");
    // Message 1 fixes John Smith = person 1.
    const m1 = await ra.anonymize("John Smith wrote.");
    expect(m1).toBe("<Name_1_First_Name> <Name_1_Last_Name> wrote.");
    // Message 2 locally numbers Jane Doe as person 1; globally she must
    // become person 2 while John Smith keeps person 1 — both parts of each
    // person share one index.
    const m2 = await ra.anonymize("Jane Doe met John Smith.");
    expect(m2).toBe(
      "<Name_2_First_Name> <Name_2_Last_Name> met <Name_1_First_Name> <Name_1_Last_Name>.",
    );
    expect(ra.mapping).toEqual({
      "<Name_1_First_Name>": "John",
      "<Name_1_Last_Name>": "Smith",
      "<Name_2_First_Name>": "Jane",
      "<Name_2_Last_Name>": "Doe",
    });
    expect(deanonymize(`${m1}\n${m2}`, ra.mapping)).toBe(
      "John Smith wrote.\nJane Doe met John Smith.",
    );
  });

  it("keeps part labels and plain labels of the same prefix on one counter", async () => {
    // 山田太郎 has no space (unsplittable, plain <人名_n>); 佐藤 花子 splits.
    const splitEngine = new Anonymizer({
      ner: new MockNer({ 山田太郎: "PERSON", "佐藤 花子": "PERSON" }),
      splitPersonNames: true,
    });
    const ra = new RequestAnonymizer(splitEngine, "ja");
    const m1 = await ra.anonymize("山田太郎です。");
    expect(m1).toBe("<人名_1>です。");
    const m2 = await ra.anonymize("佐藤 花子さんへ。");
    expect(m2).toBe("<人名_2_姓> <人名_2_名>さんへ。");
    expect(ra.mapping).toEqual({
      "<人名_1>": "山田太郎",
      "<人名_2_姓>": "佐藤",
      "<人名_2_名>": "花子",
    });
  });
});
