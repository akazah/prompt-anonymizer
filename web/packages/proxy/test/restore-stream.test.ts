import { describe, expect, it } from "vitest";
import { restoreText } from "@prompt-anonymizer/core";
import { StreamingRestorer } from "../src/restore-stream.js";

const MAPPING = {
  "<Email_1>": "alice@example.com",
  "<人名_1>": "山田太郎",
};

describe("StreamingRestorer", () => {
  it("restores a label split across two chunks", () => {
    const r = new StreamingRestorer(MAPPING);
    expect(r.push("Hello <Ema")).toBe("Hello ");
    expect(r.push("il_1> world")).toBe("alice@example.com world");
    expect(r.flush()).toBe("");
  });

  it("restores a label split across three chunks", () => {
    const r = new StreamingRestorer(MAPPING);
    expect(r.push("x <Em")).toBe("x ");
    expect(r.push("ail")).toBe("");
    expect(r.push("_1> y")).toBe("alice@example.com y");
  });

  it("emits when a label ends exactly at chunk boundary", () => {
    const r = new StreamingRestorer(MAPPING);
    expect(r.push("see <Email_1>")).toBe("see alice@example.com");
    expect(r.flush()).toBe("");
  });

  it("emits stray < after cap / on flush without treating it as a label", () => {
    const r = new StreamingRestorer(MAPPING);
    const long = "<" + "x".repeat(80);
    expect(r.push(long)).toBe(long);
    expect(r.flush()).toBe("");
  });

  it("passes through unknown placeholders unrestored", () => {
    const r = new StreamingRestorer(MAPPING);
    expect(r.push("unknown <Name_99> here")).toBe("unknown <Name_99> here");
  });

  it("handles multi-byte Japanese labels split mid-label", () => {
    const r = new StreamingRestorer(MAPPING);
    expect(r.push("こんにちは <人")).toBe("こんにちは ");
    expect(r.push("名_1>さん")).toBe("山田太郎さん");
  });

  it("flush emits pending partial suffix as-is", () => {
    const r = new StreamingRestorer(MAPPING);
    expect(r.push("tail <Em")).toBe("tail ");
    expect(r.flush()).toBe("<Em");
  });

  it("concat(push)+flush matches restoreText for every split of a fixture", () => {
    const full = "Mail <Email_1> from <人名_1> please";
    const expected = restoreText(full, MAPPING).text;

    for (let i = 0; i <= full.length; i++) {
      const r = new StreamingRestorer(MAPPING);
      let out = "";
      out += r.push(full.slice(0, i));
      out += r.push(full.slice(i));
      out += r.flush();
      expect(out).toBe(expected);
    }

    for (let i = 0; i < full.length; i++) {
      for (let j = i; j <= full.length; j++) {
        const r = new StreamingRestorer(MAPPING);
        let out = "";
        out += r.push(full.slice(0, i));
        out += r.push(full.slice(i, j));
        out += r.push(full.slice(j));
        out += r.flush();
        expect(out).toBe(expected);
      }
    }
  });
});
