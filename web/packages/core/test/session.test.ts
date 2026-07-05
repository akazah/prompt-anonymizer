import { describe, expect, it } from "vitest";
import { deanonymize } from "../src/labeling.js";
import {
  InMemoryMappingStore,
  RestoreSession,
  findPlaceholders,
  restoreText,
  type AnonymizeEngine,
  type MappingStore,
} from "../src/session.js";
import type { AnonymizeResult, Language } from "../src/types.js";

const MAPPING = {
  "<人名_1>": "山田太郎",
  "<電話番号_1>": "090-1234-5678",
};

/** Engine stub returning a fixed result (no NER, no regex). */
const stubEngine = (result: AnonymizeResult): AnonymizeEngine => ({
  anonymize: (_text: string, _options: { language: Language }) => Promise.resolve(result),
});

describe("findPlaceholders", () => {
  it("finds unique placeholder-shaped tokens in order", () => {
    const text = "<人名_1>様、<住所_1>へ。<人名_1>より <Name_23>";
    expect(findPlaceholders(text)).toEqual(["<人名_1>", "<住所_1>", "<Name_23>"]);
  });

  it("ignores angle-bracket text that is not a label", () => {
    expect(findPlaceholders("<div> a < b, x_1 > y <no-number_>")).toEqual([]);
  });
});

describe("restoreText", () => {
  it("produces the same text as deanonymize", () => {
    const reply = "<人名_1>様\nご連絡は <電話番号_1> まで。<人名_1>より";
    const result = restoreText(reply, MAPPING);
    expect(result.text).toBe(deanonymize(reply, MAPPING));
    expect(result.text).toBe("山田太郎様\nご連絡は 090-1234-5678 まで。山田太郎より");
  });

  it("reports replacement counts per label", () => {
    const result = restoreText("<人名_1> and <人名_1>, <電話番号_1>", MAPPING);
    expect(result.replacements).toEqual(
      expect.arrayContaining([
        { label: "<人名_1>", value: "山田太郎", count: 2 },
        { label: "<電話番号_1>", value: "090-1234-5678", count: 1 },
      ]),
    );
    expect(result.unresolved).toEqual([]);
  });

  it("flags placeholders the mapping does not know (model-invented labels)", () => {
    const result = restoreText("<人名_1>と<人名_9>", MAPPING);
    expect(result.text).toBe("山田太郎と<人名_9>");
    expect(result.unresolved).toEqual(["<人名_9>"]);
  });

  it("replaces longest labels first", () => {
    const result = restoreText("<Name_11> and <Name_1>", {
      "<Name_1>": "John",
      "<Name_11>": "Jane",
    });
    expect(result.text).toBe("Jane and John");
  });

  it("leaves everything unresolved when the mapping is empty", () => {
    const result = restoreText("<人名_1>様", {});
    expect(result.text).toBe("<人名_1>様");
    expect(result.replacements).toEqual([]);
    expect(result.unresolved).toEqual(["<人名_1>"]);
  });
});

describe("RestoreSession", () => {
  const anonymized: AnonymizeResult = {
    text: "<人名_1>の電話は<電話番号_1>",
    mapping: MAPPING,
    entities: [],
  };

  it("round-trips anonymize -> restore through the default in-memory store", async () => {
    const session = new RestoreSession({ engine: stubEngine(anonymized) });
    await session.anonymize("山田太郎の電話は090-1234-5678", { language: "ja" });
    const restored = await session.restore("<人名_1>様、<電話番号_1>へ折り返します。");
    expect(restored.text).toBe("山田太郎様、090-1234-5678へ折り返します。");
    expect(restored.unresolved).toEqual([]);
  });

  it("restores from an injected store adapter without a prior anonymize call", async () => {
    // Simulates the Chrome extension reopening its side panel: the mapping
    // survives in chrome.storage.session while in-memory state is gone.
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
    const session = new RestoreSession({ engine: stubEngine(anonymized), store });
    const restored = await session.restore("<人名_1>様");
    expect(restored.text).toBe("山田太郎様");
  });

  it("saves the mapping to the store on anonymize", async () => {
    const store = new InMemoryMappingStore();
    const session = new RestoreSession({ engine: stubEngine(anonymized), store });
    await session.anonymize("input", { language: "ja" });
    expect(await store.load()).toEqual(MAPPING);
    expect(await session.loadMapping()).toEqual(MAPPING);
  });

  it("reports all placeholders unresolved after clear()", async () => {
    const session = new RestoreSession({ engine: stubEngine(anonymized) });
    await session.anonymize("input", { language: "ja" });
    await session.clear();
    const restored = await session.restore("<人名_1>様");
    expect(restored.text).toBe("<人名_1>様");
    expect(restored.unresolved).toEqual(["<人名_1>"]);
  });
});
