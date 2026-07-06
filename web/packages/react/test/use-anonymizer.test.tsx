import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Anonymizer } from "@prompt-anonymizer/core";
import type { AnonymizeEngine, AnonymizeResult, Language, MappingStore } from "@prompt-anonymizer/core";
import { useAnonymizer } from "../src/index.js";

const MAPPING = {
  "<人名_1>": "山田太郎",
  "<電話番号_1>": "090-1234-5678",
};

const stubEngine = (result: AnonymizeResult): AnonymizeEngine => ({
  anonymize: (_text: string, _options: { language: Language }) => Promise.resolve(result),
});

describe("useAnonymizer", () => {
  it("anonymize updates mapping and returns the result", async () => {
    const anonymized: AnonymizeResult = {
      text: "<人名_1>の電話は<電話番号_1>",
      mapping: MAPPING,
      entities: [],
    };
    const { result } = renderHook(() => useAnonymizer({ engine: stubEngine(anonymized) }));

    let anonResult: AnonymizeResult | undefined;
    await act(async () => {
      anonResult = await result.current.anonymize("input", { language: "ja" });
    });

    expect(anonResult).toEqual(anonymized);
    expect(result.current.mapping).toEqual(MAPPING);
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("round-trips anonymize -> restore with the real regex-only Anonymizer", async () => {
    const input = "連絡は 090-1234-5678 か taro@example.com まで";
    const { result } = renderHook(() => useAnonymizer({ engine: new Anonymizer() }));

    let anonymized: AnonymizeResult | undefined;
    await act(async () => {
      anonymized = await result.current.anonymize(input, { language: "ja" });
    });

    expect(anonymized!.text).toContain("<電話番号_1>");
    expect(anonymized!.text).toContain("<メールアドレス_1>");

    const reply = "ご連絡は <電話番号_1> または <メールアドレス_1> へお返事ください。";
    let restored;
    await act(async () => {
      restored = await result.current.restore(reply);
    });

    expect(restored!.text).toContain("090-1234-5678");
    expect(restored!.text).toContain("taro@example.com");
    expect(restored!.unresolved).toEqual([]);
    expect(result.current.mapping).toEqual(anonymized!.mapping);
  });

  it("restore surfaces unresolved labels", async () => {
    const anonymized: AnonymizeResult = {
      text: "<人名_1>と<人名_9>",
      mapping: MAPPING,
      entities: [],
    };
    const { result } = renderHook(() => useAnonymizer({ engine: stubEngine(anonymized) }));

    await act(async () => {
      await result.current.anonymize("input", { language: "ja" });
    });

    let restored;
    await act(async () => {
      restored = await result.current.restore("<人名_1>と<人名_9>");
    });

    expect(restored!.text).toBe("山田太郎と<人名_9>");
    expect(restored!.unresolved).toEqual(["<人名_9>"]);
  });

  it("clear resets mapping and later restore leaves placeholders unresolved", async () => {
    const anonymized: AnonymizeResult = {
      text: "<人名_1>様",
      mapping: MAPPING,
      entities: [],
    };
    const { result } = renderHook(() => useAnonymizer({ engine: stubEngine(anonymized) }));

    await act(async () => {
      await result.current.anonymize("input", { language: "ja" });
    });
    expect(result.current.mapping).toEqual(MAPPING);

    await act(async () => {
      await result.current.clear();
    });
    expect(result.current.mapping).toBeNull();

    let restored;
    await act(async () => {
      restored = await result.current.restore("<人名_1>様");
    });
    expect(restored!.text).toBe("<人名_1>様");
    expect(restored!.unresolved).toEqual(["<人名_1>"]);
  });

  it("sets error and rethrows when the engine rejects", async () => {
    const failingEngine: AnonymizeEngine = {
      anonymize: () => Promise.reject("boom"),
    };
    const { result } = renderHook(() => useAnonymizer({ engine: failingEngine }));

    await act(async () => {
      await expect(result.current.anonymize("x", { language: "en" })).rejects.toThrow("boom");
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("boom");
    expect(result.current.busy).toBe(false);
  });

  it("loads initial mapping from an injected pre-populated store", async () => {
    const backing: { mapping: Record<string, string> | null } = { mapping: MAPPING };
    const store: MappingStore = {
      load: () => Promise.resolve(backing.mapping),
      save: (mapping) => {
        backing.mapping = mapping;
        return Promise.resolve();
      },
      clear: () => {
        backing.mapping = null;
        return Promise.resolve();
      },
    };

    const { result } = renderHook(() =>
      useAnonymizer({ engine: stubEngine({ text: "", mapping: {}, entities: [] }), store }),
    );

    await waitFor(() => {
      expect(result.current.mapping).toEqual(MAPPING);
    });
  });
});
