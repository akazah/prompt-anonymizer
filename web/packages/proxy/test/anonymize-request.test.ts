import { describe, expect, it } from "vitest";
import { Anonymizer, deanonymize } from "@prompt-anonymizer/core";
import { RequestAnonymizer } from "../src/anonymize-request.js";

const engine = new Anonymizer();

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
});
