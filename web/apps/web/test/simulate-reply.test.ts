/**
 * Pure-function tests for the simulated LLM reply: every emitted label must
 * come from the live mapping (so restore never warns), person labels lead,
 * and the {labels} slot is filled for every supported language.
 */

import { LABELS, SUPPORTED_LANGUAGES } from "@prompt-anonymizer/core";
import { describe, expect, it } from "vitest";
import { buildSimulatedReply, classifyLabel } from "../src/simulate-reply.js";
import { t } from "../src/ui-i18n.js";

const PLACEHOLDER = /<[^<>\s]{1,64}_\d{1,6}(?:_[^<>\s]{1,32})?>/gu;

function mappingFor(lang: (typeof SUPPORTED_LANGUAGES)[number]): Record<string, string> {
  const words = LABELS[lang];
  return {
    [`<${words.EMAIL_ADDRESS}_1>`]: "a@example.com",
    [`<${words.PERSON}_1>`]: "Person One",
    [`<${words.PHONE_NUMBER}_1>`]: "090-0000-0000",
    [`<${words.PERSON}_2>`]: "Person Two",
    [`<${words.LOCATION}_1>`]: "Somewhere",
  };
}

describe("buildSimulatedReply", () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    it(`${lang}: fills the template with labels that all resolve`, () => {
      const mapping = mappingFor(lang);
      const reply = buildSimulatedReply(mapping, {
        labelLanguage: lang,
        uiLanguage: lang,
        template: t(lang, "simulatedReplyTemplate"),
      });

      expect(reply).not.toContain("{labels}");
      const emitted = reply.match(PLACEHOLDER) ?? [];
      expect(emitted.length).toBeGreaterThan(0);
      for (const label of emitted) {
        expect(mapping).toHaveProperty(label);
      }
    });
  }

  it("prefers person labels, then emails, then phones, capped at four", () => {
    const mapping = mappingFor("en");
    const reply = buildSimulatedReply(mapping, {
      labelLanguage: "en",
      uiLanguage: "en",
      template: "{labels}",
    });

    const emitted = reply.match(PLACEHOLDER) ?? [];
    expect(emitted).toEqual(["<Name_1>", "<Name_2>", "<Email_1>", "<Phone_1>"]);
  });

  it("keeps working when the mapping has no recognizable labels", () => {
    const reply = buildSimulatedReply(
      { "<Mystery_1>": "value" },
      { labelLanguage: "en", uiLanguage: "en", template: "Reply to {labels}." },
    );
    expect(reply).toBe("Reply to <Mystery_1>.");
  });
});

describe("classifyLabel", () => {
  it("resolves plain and name-part label forms", () => {
    expect(classifyLabel("<人名_1>", "ja")).toBe("PERSON");
    expect(classifyLabel("<Name_1>", "en")).toBe("PERSON");
    expect(classifyLabel("<Name_1_First_Name>", "en")).toBe("PERSON");
    expect(classifyLabel("<Email_2>", "en")).toBe("EMAIL_ADDRESS");
    expect(classifyLabel("<Unknown_1>", "en")).toBeNull();
    expect(classifyLabel("not a label", "en")).toBeNull();
  });
});
