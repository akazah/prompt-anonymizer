/**
 * Measures the TS core's regex recognizers against the shared golden set
 * (tests/golden/*.json) and prints a Markdown table matching docs/EVAL.md.
 *
 * NER entities (PERSON / LOCATION) are excluded: they require a model
 * download and are covered by the Python table and browser usage.
 *
 * Usage (from web/packages/core, after build):
 *   node scripts/eval-golden.mjs           Print the Markdown table.
 *   node scripts/eval-golden.mjs --check   Compare against the TypeScript
 *                                          table in docs/EVAL.md; exit 1 on
 *                                          drift (for CI).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeSpans } from "../dist/labeling.js";
import { SUPPORTED_LANGUAGES } from "../dist/languages.js";
import { detectWithRegex } from "../dist/recognizers.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(HERE, "../../../../tests/golden");
const EVAL_MD = join(HERE, "../../../../docs/EVAL.md");
const TS_HEADING = "## TypeScript core (regex recognizers, structured PII only)";
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

function buildTable() {
  const lines = [
    "| Language | Entity | Precision | Recall | F1 | Support |",
    "|---|---|---|---|---|---|",
  ];

  for (const language of SUPPORTED_LANGUAGES) {
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
      lines.push(
        `| ${language} | ${entity} | ${precision.toFixed(2)} | ${recall.toFixed(2)} | ${f1.toFixed(2)} | ${tp + fn} |`,
      );
    }
  }
  return lines;
}

/** First Markdown table after the TypeScript-core heading in docs/EVAL.md. */
function documentedTable() {
  const lines = readFileSync(EVAL_MD, "utf-8").split("\n");
  const headingIndex = lines.findIndex((line) => line.trim() === TS_HEADING);
  if (headingIndex < 0) {
    throw new Error(`Heading not found in docs/EVAL.md: ${TS_HEADING}`);
  }
  let start = headingIndex + 1;
  while (start < lines.length && !lines[start].startsWith("|")) start++;
  if (start >= lines.length) {
    throw new Error("No Markdown table found after the TypeScript-core heading in docs/EVAL.md.");
  }
  let end = start;
  while (end < lines.length && lines[end].startsWith("|")) end++;
  return lines.slice(start, end).map((line) => line.trimEnd());
}

const generated = buildTable();

if (process.argv.includes("--check")) {
  const documented = documentedTable();
  if (generated.join("\n") === documented.join("\n")) {
    console.log("docs/EVAL.md TypeScript table is up to date.");
    process.exit(0);
  }
  console.error("docs/EVAL.md TypeScript table is out of date.\n");
  const rows = Math.max(generated.length, documented.length);
  for (let i = 0; i < rows; i++) {
    const doc = documented[i] ?? "<missing>";
    const gen = generated[i] ?? "<missing>";
    if (doc !== gen) {
      console.error(`- ${doc}`);
      console.error(`+ ${gen}`);
    }
  }
  console.error(
    "\nRegenerate with: node scripts/eval-golden.mjs (in web/packages/core, after pnpm build)",
  );
  process.exit(1);
} else {
  console.log(generated.join("\n"));
}
