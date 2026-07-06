/**
 * Measures the TS core's regex recognizers against the shared golden set
 * (tests/golden/*.json) and prints a Markdown table matching docs/EVAL.md.
 *
 * NER entities (PERSON / LOCATION) are excluded: they require a model
 * download and are covered by the Python table and browser usage.
 *
 * Usage: node scripts/eval-golden.mjs   (from web/packages/core, after build)
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeSpans } from "../dist/labeling.js";
import { LANGUAGES } from "../dist/types.js";
import { detectWithRegex } from "../dist/recognizers.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(HERE, "../../../../tests/golden");
const REGEX_ENTITIES = new Set([
  "EMAIL_ADDRESS",
  "PHONE_NUMBER",
  "JP_POSTAL_CODE",
  "JP_MY_NUMBER",
  "CREDIT_CARD",
  "US_SSN",
  "IBAN_CODE",
]);

const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;

console.log("| Language | Entity | Precision | Recall | F1 | Support |");
console.log("|---|---|---|---|---|---|");

for (const language of LANGUAGES) {
  const cases = JSON.parse(readFileSync(join(GOLDEN_DIR, `golden_${language}.json`), "utf-8"));
  const metrics = new Map();
  const m = (entity) => {
    if (!metrics.has(entity)) metrics.set(entity, { tp: 0, fp: 0, fn: 0 });
    return metrics.get(entity);
  };

  for (const goldenCase of cases) {
    // Merge overlapping raw matches exactly like the Anonymizer pipeline does.
    const preds = mergeSpans(detectWithRegex(goldenCase.text, language)).filter((p) =>
      REGEX_ENTITIES.has(p.entityType),
    );
    const golds = goldenCase.spans.filter((g) => REGEX_ENTITIES.has(g.entity_type));
    const used = new Set();
    for (const gold of golds) {
      const hitIndex = preds.findIndex(
        (p, i) =>
          !used.has(i) &&
          p.entityType === gold.entity_type &&
          overlaps(p.start, p.end, gold.start, gold.end),
      );
      if (hitIndex >= 0) {
        used.add(hitIndex);
        m(gold.entity_type).tp++;
      } else {
        m(gold.entity_type).fn++;
      }
    }
    preds.forEach((p, i) => {
      if (!used.has(i)) m(p.entityType).fp++;
    });
  }

  for (const entity of [...metrics.keys()].sort()) {
    const { tp, fp, fn } = metrics.get(entity);
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    console.log(
      `| ${language} | ${entity} | ${precision.toFixed(2)} | ${recall.toFixed(2)} | ${f1.toFixed(2)} | ${tp + fn} |`,
    );
  }
}
