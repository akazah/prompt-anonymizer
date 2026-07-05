import { describe, expect, it } from "vitest";
import { findSpan } from "../src/ner.js";

describe("findSpan (token -> text alignment)", () => {
  it("aligns SentencePiece tokens with ▁ boundaries", () => {
    const text = "山田太郎は東京に住んでいます";
    const span = findSpan(text, 0, ["\u2581山田", "太郎"]);
    expect(span).toEqual({ start: 0, end: 4 });
  });

  it("aligns BERT ## continuations", () => {
    const text = "Contact Johnathan today";
    const span = findSpan(text, 0, ["John", "##athan"]);
    expect(span).toEqual({ start: 8, end: 16 });
  });

  it("searches from the cursor to disambiguate repeats", () => {
    const text = "John met John";
    const first = findSpan(text, 0, ["John"]);
    expect(first).toEqual({ start: 0, end: 4 });
    const second = findSpan(text, first!.end, ["John"]);
    expect(second).toEqual({ start: 9, end: 13 });
  });

  it("tolerates whitespace between multi-word entities", () => {
    const text = "He lives in New  York now";
    const span = findSpan(text, 0, ["\u2581New", "\u2581York"]);
    expect(span).toEqual({ start: 12, end: 21 });
  });

  it("returns null when tokens cannot be aligned", () => {
    expect(findSpan("abc", 0, ["xyz"])).toBeNull();
  });
});
