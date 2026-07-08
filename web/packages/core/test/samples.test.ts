import { describe, expect, it } from "vitest";

import { SUPPORTED_LANGUAGES } from "../src/languages.js";
import { SAMPLES } from "../src/samples.js";

describe("SAMPLES", () => {
  it("covers every supported language with a non-empty paragraph", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(SAMPLES[language]?.trim().length ?? 0).toBeGreaterThan(40);
    }
  });
});
