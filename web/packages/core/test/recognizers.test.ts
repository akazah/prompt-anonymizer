import { describe, expect, it } from "vitest";
import {
  detectDenyList,
  detectWithRegex,
  isValidCreditCard,
  isValidIban,
  isValidMyNumber,
  isValidUsSsn,
  myNumberCheckDigit,
} from "../src/recognizers.js";

describe("myNumberCheckDigit", () => {
  it("computes a digit that validates", () => {
    const body = "12345678901";
    const digit = myNumberCheckDigit(body);
    expect(isValidMyNumber(body + String(digit))).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    const body = "12345678901";
    const digit = myNumberCheckDigit(body);
    expect(isValidMyNumber(body + String((digit + 1) % 10))).toBe(false);
  });

  it("accepts grouped notation", () => {
    const body = "98765432109";
    const digit = myNumberCheckDigit(body);
    const grouped = `${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}${digit}`;
    expect(isValidMyNumber(grouped)).toBe(true);
  });
});

describe("detectWithRegex", () => {
  it("detects emails", () => {
    const spans = detectWithRegex("contact me at taro@example.com please", "en");
    expect(spans.some((s) => s.entityType === "EMAIL_ADDRESS")).toBe(true);
  });

  it("detects JP mobile numbers in prose", () => {
    const spans = detectWithRegex("連絡先は090-1234-5678です", "ja");
    const phone = spans.find((s) => s.entityType === "PHONE_NUMBER");
    expect(phone).toBeDefined();
  });

  it("detects US phone formats", () => {
    const spans = detectWithRegex("Call (333) 333-3333 today", "en");
    expect(spans.some((s) => s.entityType === "PHONE_NUMBER")).toBe(true);
  });

  it("detects marked postal codes", () => {
    const spans = detectWithRegex("送付先: 〒100-0001 東京都千代田区", "ja");
    expect(spans.some((s) => s.entityType === "JP_POSTAL_CODE")).toBe(true);
  });

  it("does not flag postal codes inside phone numbers", () => {
    const spans = detectWithRegex("090-1234-5678", "ja");
    expect(spans.some((s) => s.entityType === "JP_POSTAL_CODE")).toBe(false);
  });

  it("does not flag 9-digit SSN-shaped strings as JP landlines", () => {
    const spans = detectWithRegex("Payroll: SSN 021-14-3596, thanks", "en");
    expect(spans.some((s) => s.entityType === "PHONE_NUMBER")).toBe(false);
    expect(spans.some((s) => s.entityType === "US_SSN")).toBe(true);
  });

  it("detects Luhn-valid credit cards next to CJK text", () => {
    const spans = detectWithRegex("カード番号は4111111111111111です", "ja");
    const card = spans.find((s) => s.entityType === "CREDIT_CARD");
    expect(card).toBeDefined();
    expect(card!.score).toBe(1.0);
  });

  it("detects hyphenated credit cards", () => {
    const spans = detectWithRegex("The card on file is 4111-1111-1111-1111.", "en");
    expect(spans.some((s) => s.entityType === "CREDIT_CARD")).toBe(true);
  });

  it("rejects Luhn-invalid card-like numbers", () => {
    const spans = detectWithRegex("注文コードは4111111111111112です", "ja");
    expect(spans.some((s) => s.entityType === "CREDIT_CARD")).toBe(false);
  });

  it("does not flag 13-digit unix timestamps", () => {
    const spans = detectWithRegex("timestamp 1748503543012 end", "en");
    expect(spans.some((s) => s.entityType === "CREDIT_CARD")).toBe(false);
  });

  it("does not flag a valid my number as a credit card", () => {
    const body = "12345678901";
    const myNumber = body + String(myNumberCheckDigit(body));
    const spans = detectWithRegex(`マイナンバーは ${myNumber} です`, "ja");
    expect(spans.some((s) => s.entityType === "CREDIT_CARD")).toBe(false);
  });

  it("only accepts my numbers with a valid check digit", () => {
    const body = "12345678901";
    const good = body + String(myNumberCheckDigit(body));
    const bad = body + String((myNumberCheckDigit(body) + 1) % 10);
    expect(
      detectWithRegex(`番号は ${good} です`, "ja").some((s) => s.entityType === "JP_MY_NUMBER"),
    ).toBe(true);
    expect(
      detectWithRegex(`番号は ${bad} です`, "ja").some((s) => s.entityType === "JP_MY_NUMBER"),
    ).toBe(false);
  });

  it("detects Spanish phone formats", () => {
    for (const sample of [
      "+34 612 345 678",
      "612 345 678",
      "612-345-678",
      "91 234 56 78",
    ]) {
      const spans = detectWithRegex(`Llámame al ${sample}`, "es");
      expect(spans.some((s) => s.entityType === "PHONE_NUMBER")).toBe(true);
    }
  });

  it("rejects bare 9-digit Spanish numbers without separators or prefix", () => {
    const spans = detectWithRegex("612345678", "es");
    expect(spans.some((s) => s.entityType === "PHONE_NUMBER")).toBe(false);
  });

  it("detects Vietnamese phone formats", () => {
    for (const sample of [
      "0912 345 678",
      "091 234 5678",
      "0912345678",
      "+84 912 345 678",
      "024 3826 8888",
    ]) {
      const spans = detectWithRegex(`Gọi ${sample}`, "vi");
      expect(spans.some((s) => s.entityType === "PHONE_NUMBER")).toBe(true);
    }
  });

  it("detects phone formats for the six new languages", () => {
    const samples: Array<[Parameters<typeof detectWithRegex>[1], string]> = [
      ["zh", "手机是 138 0013 8000"],
      ["zh", "+86 159-4606-2826"],
      ["ko", "전화는 010-1234-5678"],
      ["ko", "+82 10-1234-5678"],
      ["fr", "appelez le 06 12 34 56 78"],
      ["fr", "+33 6 12 34 56 78"],
      ["de", "Telefon: 030 901820"],
      ["de", "+49 171 2345678"],
      ["pt", "ligue para 912 345 678"],
      ["pt", "+351 912 345 678"],
      ["it", "chiamami al 333 123 4567"],
      ["it", "+39 333 123 4567"],
    ];
    for (const [language, text] of samples) {
      const types = detectWithRegex(text, language).map((s) => s.entityType);
      expect(types, `${language}: ${text}`).toContain("PHONE_NUMBER");
    }
  });

  it("does not fire new-language phone patterns on English text", () => {
    // A Chinese bare mobile (11 digits, no separators) must not fire on en.
    expect(
      detectWithRegex("order id 13800138000", "en").filter((s) => s.entityType === "PHONE_NUMBER"),
    ).toEqual([]);
    // A Portuguese grouped mobile must not fire on en either.
    expect(
      detectWithRegex("ref 912 345 678", "en").filter((s) => s.entityType === "PHONE_NUMBER"),
    ).toEqual([]);
  });

  it("does not detect Vietnamese phones when language is en", () => {
    const spans = detectWithRegex("Call 0912 345 678", "en");
    expect(spans.some((s) => s.entityType === "PHONE_NUMBER")).toBe(false);
  });

  it("does not match phone digits embedded in longer runs", () => {
    const spans = detectWithRegex("id10912345678end", "vi");
    expect(spans.some((s) => s.entityType === "PHONE_NUMBER")).toBe(false);
  });

  it("detects US SSN in English prose", () => {
    const spans = detectWithRegex("SSN on file: 856-45-6780", "en");
    expect(spans.some((s) => s.entityType === "US_SSN")).toBe(true);
  });

  it("detects US SSN adjacent to CJK text", () => {
    const spans = detectWithRegex("社会保障番号は856-45-6780です", "ja");
    expect(spans.some((s) => s.entityType === "US_SSN")).toBe(true);
  });

  it("does not match US SSN inside longer digit runs", () => {
    const spans = detectWithRegex("id 1856-45-67801 trailing", "en");
    expect(spans.some((s) => s.entityType === "US_SSN")).toBe(false);
  });

  it("detects spaced IBANs", () => {
    const spans = detectWithRegex("Transfer to DE89 3704 0044 0532 0130 00 please", "en");
    const iban = spans.find((s) => s.entityType === "IBAN_CODE");
    expect(iban).toBeDefined();
    expect(iban!.score).toBe(1.0);
  });

  it("detects compact IBANs", () => {
    const spans = detectWithRegex("IBAN DE89370400440532013000", "en");
    expect(spans.some((s) => s.entityType === "IBAN_CODE")).toBe(true);
  });

  it("detects IBAN adjacent to CJK text", () => {
    const spans = detectWithRegex("振込先はDE89370400440532013000です", "ja");
    expect(spans.some((s) => s.entityType === "IBAN_CODE")).toBe(true);
  });

  it("rejects checksum-invalid IBANs", () => {
    const spans = detectWithRegex("振込先はDE89370400440532013001です", "ja");
    expect(spans.some((s) => s.entityType === "IBAN_CODE")).toBe(false);
  });

  it("does not match IBAN inside a longer alphanumeric run", () => {
    const spans = detectWithRegex("ref XDE89370400440532013000Y end", "en");
    expect(spans.some((s) => s.entityType === "IBAN_CODE")).toBe(false);
  });
});

describe("isValidCreditCard", () => {
  it("validates Luhn checksums with and without separators", () => {
    expect(isValidCreditCard("4111111111111111")).toBe(true);
    expect(isValidCreditCard("4111-1111-1111-1111")).toBe(true);
    expect(isValidCreditCard("4111 1111 1111 1111")).toBe(true);
    expect(isValidCreditCard("4111111111111112")).toBe(false);
    expect(isValidCreditCard("not-a-number")).toBe(false);
  });
});

describe("isValidUsSsn", () => {
  it("accepts a valid SSN and rejects known-invalid forms", () => {
    expect(isValidUsSsn("856-45-6780")).toBe(true);
    expect(isValidUsSsn("000-12-3456")).toBe(false);
    expect(isValidUsSsn("123-45-6789")).toBe(false);
    expect(isValidUsSsn("123.45-6789")).toBe(false);
    expect(isValidUsSsn("111-11-1111")).toBe(false);
    expect(isValidUsSsn("856-00-6780")).toBe(false);
  });
});

describe("isValidIban", () => {
  it("validates checksums after stripping separators", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("DE89370400440532013000")).toBe(true);
    expect(isValidIban("DE89370400440532013001")).toBe(false);
  });
});

describe("detectDenyList", () => {
  it("finds every occurrence", () => {
    const spans = detectDenyList("X計画のことをX計画と呼ぶ", ["X計画"]);
    expect(spans).toHaveLength(2);
    expect(spans.every((s) => s.entityType === "CUSTOM")).toBe(true);
  });
});

/**
 * Score parity table (Python vs web/packages/core recognizers.ts).
 * Scores intentionally differ today; this pin makes future drift visible.
 *   jp_mobile     py 0.6 / ts 0.7
 *   jp_landline   py 0.5 / ts 0.6
 *   jp_tollfree   py 0.6 / ts 0.7
 *   us_phone      py 0.6 / ts 0.6
 *   postal_marked py 0.9 / ts 0.9
 *   postal_bare   py 0.3 (all langs, context-boosted) / ts 0.35 (ja only)
 *   my_number     py 0.5 -> 1.0 on check-digit / ts 0.7 flat
 *   credit_card   py 0.3 -> 1.0 on Luhn / ts 1.0 (pre-validated)
 */
describe("detectWithRegex score pins", () => {
  it("emits JP mobile at 0.7", () => {
    const spans = detectWithRegex("090-1234-5678", "ja");
    const phone = spans.find((s) => s.entityType === "PHONE_NUMBER" && s.score === 0.7);
    expect(phone).toBeDefined();
  });

  it("emits JP toll-free at 0.7", () => {
    const spans = detectWithRegex("0120-123-456", "ja");
    const phone = spans.find((s) => s.entityType === "PHONE_NUMBER" && s.score === 0.7);
    expect(phone).toBeDefined();
  });

  it("emits JP landline at 0.6", () => {
    const spans = detectWithRegex("03-1234-5678", "ja");
    const phone = spans.find((s) => s.entityType === "PHONE_NUMBER" && s.score === 0.6);
    expect(phone).toBeDefined();
  });

  it("emits US phone at 0.6", () => {
    const spans = detectWithRegex("(333) 333-3333", "en");
    const phone = spans.find((s) => s.entityType === "PHONE_NUMBER" && s.score === 0.6);
    expect(phone).toBeDefined();
  });

  it("emits marked postal code at 0.9", () => {
    const spans = detectWithRegex("〒100-0001", "ja");
    const postal = spans.find((s) => s.entityType === "JP_POSTAL_CODE" && s.score === 0.9);
    expect(postal).toBeDefined();
  });

  it("emits bare postal code at 0.35 (ja only)", () => {
    const spans = detectWithRegex("100-0001", "ja");
    const postal = spans.find((s) => s.entityType === "JP_POSTAL_CODE" && s.score === 0.35);
    expect(postal).toBeDefined();
  });

  it("emits valid my number at 0.7", () => {
    const body = "12345678901";
    const myNumber = body + String(myNumberCheckDigit(body));
    const spans = detectWithRegex(`マイナンバー${myNumber}です`, "ja");
    const mn = spans.find((s) => s.entityType === "JP_MY_NUMBER" && s.score === 0.7);
    expect(mn).toBeDefined();
  });

  it("emits Luhn-valid credit card at 1.0", () => {
    const spans = detectWithRegex("4111111111111111", "ja");
    const card = spans.find((s) => s.entityType === "CREDIT_CARD" && s.score === 1.0);
    expect(card).toBeDefined();
  });

  it("emits email address at 0.9", () => {
    const spans = detectWithRegex("taro@example.com", "en");
    const email = spans.find((s) => s.entityType === "EMAIL_ADDRESS" && s.score === 0.9);
    expect(email).toBeDefined();
  });
});
