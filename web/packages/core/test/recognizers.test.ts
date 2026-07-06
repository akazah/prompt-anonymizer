import { describe, expect, it } from "vitest";
import {
  detectDenyList,
  detectWithRegex,
  isValidCreditCard,
  isValidMyNumber,
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

describe("detectDenyList", () => {
  it("finds every occurrence", () => {
    const spans = detectDenyList("X計画のことをX計画と呼ぶ", ["X計画"]);
    expect(spans).toHaveLength(2);
    expect(spans.every((s) => s.entityType === "CUSTOM")).toBe(true);
  });
});
