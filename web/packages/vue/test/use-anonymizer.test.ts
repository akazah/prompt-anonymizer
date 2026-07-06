import { Anonymizer } from "@prompt-anonymizer/core";
import type {
  AnonymizeEngine,
  AnonymizeResult,
  Language,
  MappingStore,
} from "@prompt-anonymizer/core";
import { describe, expect, it, vi } from "vitest";
import { useAnonymizer } from "../src/index.js";

const MAPPING = {
  "<人名_1>": "山田太郎",
  "<電話番号_1>": "090-1234-5678",
};

const stubEngine = (result: AnonymizeResult): AnonymizeEngine => ({
  anonymize: (_text: string, _options: { language: Language }) => Promise.resolve(result),
});

describe("useAnonymizer", () => {
  it("anonymize with stub engine updates mapping and clears busy", async () => {
    const anonymized: AnonymizeResult = {
      text: "<人名_1>の電話は<電話番号_1>",
      mapping: MAPPING,
      entities: [],
    };
    const { anonymize, mapping, busy } = useAnonymizer({ engine: stubEngine(anonymized) });

    expect(busy.value).toBe(false);
    const result = await anonymize("input", { language: "ja" });
    expect(result).toEqual(anonymized);
    expect(mapping.value).toEqual(MAPPING);
    expect(busy.value).toBe(false);
  });

  it("round-trips with regex-only Anonymizer", async () => {
    const { anonymize, restore } = useAnonymizer();
    const input = "連絡は 090-1234-5678 か taro@example.com まで";
    const result = await anonymize(input, { language: "ja" });

    expect(result.text).toContain("<電話番号_1>");
    expect(result.text).toContain("<メールアドレス_1>");

    const restored = await restore(
      "ご連絡は <電話番号_1> または <メールアドレス_1> へお願いします。",
    );
    expect(restored.text).toBe(
      "ご連絡は 090-1234-5678 または taro@example.com へお願いします。",
    );
    expect(restored.unresolved).toEqual([]);
  });

  it("restore surfaces unresolved labels", async () => {
    const anonymized: AnonymizeResult = {
      text: "<人名_1>",
      mapping: { "<人名_1>": "山田太郎" },
      entities: [],
    };
    const { anonymize, restore } = useAnonymizer({ engine: stubEngine(anonymized) });
    await anonymize("input", { language: "ja" });

    const restored = await restore("<人名_1>と<人名_9>");
    expect(restored.text).toBe("山田太郎と<人名_9>");
    expect(restored.unresolved).toEqual(["<人名_9>"]);
  });

  it("clear resets mapping and restore leaves placeholders unresolved", async () => {
    const anonymized: AnonymizeResult = {
      text: "<人名_1>の電話は<電話番号_1>",
      mapping: MAPPING,
      entities: [],
    };
    const { anonymize, clear, restore, mapping } = useAnonymizer({
      engine: stubEngine(anonymized),
    });

    await anonymize("input", { language: "ja" });
    expect(mapping.value).toEqual(MAPPING);
    await clear();
    expect(mapping.value).toBeNull();

    const restored = await restore("<人名_1>様");
    expect(restored.text).toBe("<人名_1>様");
    expect(restored.unresolved).toEqual(["<人名_1>"]);
  });

  it("sets error and rethrows when engine rejects", async () => {
    const engine: AnonymizeEngine = {
      anonymize: () => Promise.reject("boom"),
    };
    const { anonymize, error, busy } = useAnonymizer({ engine });

    await expect(anonymize("x", { language: "en" })).rejects.toThrow("boom");
    expect(error.value?.message).toBe("boom");
    expect(busy.value).toBe(false);
  });

  it("loads initial mapping from injected store", async () => {
    const store: MappingStore = {
      load: () => Promise.resolve(MAPPING),
      save: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    };
    const anonymized: AnonymizeResult = {
      text: "<人名_1>",
      mapping: MAPPING,
      entities: [],
    };
    const { mapping } = useAnonymizer({ engine: stubEngine(anonymized), store });

    await vi.waitFor(() => {
      expect(mapping.value).toEqual(MAPPING);
    });
  });
});
