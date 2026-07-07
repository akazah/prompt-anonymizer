/**
 * Cross-core parity: the Python core's label YAML files
 * (src/prompt_anonymizer/labels/*.yaml) must match the TS core exactly —
 * same language set as the registry, byte-identical label values. Adding a
 * language or editing a label on only one side fails here.
 */

import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LABELS } from "../src/labeling.js";
import { SUPPORTED_LANGUAGES, isLanguage } from "../src/languages.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const LABELS_DIR = join(HERE, "../../../../src/prompt_anonymizer/labels");

/**
 * Minimal parser for the flat `KEY: value` label files (no nesting, no
 * quoting) — avoids a YAML dependency in the core's test suite.
 */
function parseFlatYaml(path: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const rawLine of readFileSync(path, "utf-8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf(": ");
    expect(separator, `unparseable line in ${basename(path)}: ${rawLine}`).toBeGreaterThan(0);
    map[line.slice(0, separator)] = line.slice(separator + 2).trim();
  }
  return map;
}

const yamlFiles = readdirSync(LABELS_DIR).filter((f) => f.endsWith(".yaml"));

describe("labels parity with the Python core", () => {
  it("label files cover exactly the registry languages", () => {
    const fileLanguages = new Set(yamlFiles.map((f) => basename(f, ".yaml")));
    expect(fileLanguages).toEqual(new Set(SUPPORTED_LANGUAGES));
  });

  it.each(yamlFiles)("%s matches LABELS exactly", (file) => {
    const language = basename(file, ".yaml");
    expect(isLanguage(language)).toBe(true);
    if (!isLanguage(language)) return;
    expect(parseFlatYaml(join(LABELS_DIR, file))).toEqual(LABELS[language]);
  });
});
