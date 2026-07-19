/**
 * Measures the TS core against the shared golden set (tests/golden/*.json) and
 * prints Markdown tables matching docs/EVAL.md.
 *
 * - Regex recognizers (structured PII only; NER excluded).
 * - Name-part splitting heuristic (`splitPersonName`) on golden PERSON spans.
 *
 * Usage (from web/packages/core, after build):
 *   node scripts/eval-golden.mjs           Print both Markdown tables.
 *   node scripts/eval-golden.mjs --check   Compare against docs/EVAL.md; exit 1
 *                                          on drift (for CI).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeSpans, splitPersonName } from "../dist/labeling.js";
import { FAMILY_NAME_FIRST, SUPPORTED_LANGUAGES } from "../dist/languages.js";
import { detectWithRegex } from "../dist/recognizers.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(HERE, "../../../../tests/golden");
const EVAL_MD = join(HERE, "../../../../docs/EVAL.md");
const TS_HEADING = "## TypeScript core (regex recognizers, structured PII only)";
const TS_NAME_PARTS_START = "<!-- ts-name-parts-eval:start -->";
const TS_NAME_PARTS_END = "<!-- ts-name-parts-eval:end -->";
const REGEX_ENTITIES = new Set([
  "EMAIL_ADDRESS",
  "PHONE_NUMBER",
  "JP_POSTAL_CODE",
  "JP_MY_NUMBER",
  "CREDIT_CARD",
  "US_SSN",
  "IBAN_CODE",
]);
const NAME_PART_TYPES = new Set([
  "PERSON_FIRST_NAME",
  "PERSON_MIDDLE_NAME",
  "PERSON_LAST_NAME",
]);
const PART_TYPE_BY_KEY = {
  first: "PERSON_FIRST_NAME",
  middle: "PERSON_MIDDLE_NAME",
  last: "PERSON_LAST_NAME",
};

const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;
const exactMatch = (aS, aE, bS, bE) => aS === bS && aE === bE;

function formatMetrics(metrics) {
  const lines = [
    "| Language | Entity | Precision | Recall | F1 | Support |",
    "|---|---|---|---|---|---|",
  ];
  for (const [language, perEntity] of metrics) {
    for (const entity of [...perEntity.keys()].sort()) {
      const { tp, fp, fn } = perEntity.get(entity);
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

function buildRegexTable() {
  const metrics = new Map();

  for (const language of SUPPORTED_LANGUAGES) {
    const cases = JSON.parse(readFileSync(join(GOLDEN_DIR, `golden_${language}.json`), "utf-8"));
    const perEntity = new Map();
    const m = (entity) => {
      if (!perEntity.has(entity)) perEntity.set(entity, { tp: 0, fp: 0, fn: 0 });
      return perEntity.get(entity);
    };

    for (const goldenCase of cases) {
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

    metrics.set(language, perEntity);
  }
  return formatMetrics(metrics);
}

function buildNamePartsTable() {
  const metrics = new Map();

  for (const language of SUPPORTED_LANGUAGES) {
    const cases = JSON.parse(readFileSync(join(GOLDEN_DIR, `golden_${language}.json`), "utf-8"));
    const perEntity = new Map();
    const m = (entity) => {
      if (!perEntity.has(entity)) perEntity.set(entity, { tp: 0, fp: 0, fn: 0 });
      return perEntity.get(entity);
    };
    const familyNameFirst = FAMILY_NAME_FIRST[language];

    for (const goldenCase of cases) {
      const persons = goldenCase.spans.filter((s) => s.entity_type === "PERSON");
      const goldParts = goldenCase.spans.filter((s) => NAME_PART_TYPES.has(s.entity_type));
      const predicted = [];
      for (const person of persons) {
        const hasGoldParts = goldParts.some(
          (part) => person.start <= part.start && part.end <= person.end,
        );
        if (!hasGoldParts) continue;
        const source = goldenCase.text.slice(person.start, person.end);
        for (const { part, start: relStart, end: relEnd } of splitPersonName(
          source,
          familyNameFirst,
        )) {
          predicted.push({
            start: person.start + relStart,
            end: person.start + relEnd,
            entityType: PART_TYPE_BY_KEY[part],
          });
        }
      }
      const used = new Set();
      for (const gold of goldParts) {
        const hitIndex = predicted.findIndex(
          (p, i) =>
            !used.has(i) &&
            p.entityType === gold.entity_type &&
            exactMatch(p.start, p.end, gold.start, gold.end),
        );
        if (hitIndex >= 0) {
          used.add(hitIndex);
          m(gold.entity_type).tp++;
        } else {
          m(gold.entity_type).fn++;
        }
      }
      predicted.forEach((p, i) => {
        if (!used.has(i)) m(p.entityType).fp++;
      });
    }

    metrics.set(language, perEntity);
  }
  return formatMetrics(metrics);
}

/** First Markdown table after the TypeScript-core heading in docs/EVAL.md. */
function documentedRegexTable() {
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

function documentedNamePartsTable() {
  const doc = readFileSync(EVAL_MD, "utf-8");
  if (!doc.includes(TS_NAME_PARTS_START) || !doc.includes(TS_NAME_PARTS_END)) {
    throw new Error(`Name-parts marker block missing in docs/EVAL.md`);
  }
  const block = doc.split(TS_NAME_PARTS_START)[1].split(TS_NAME_PARTS_END)[0];
  return block
    .trim()
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) => line.trimEnd());
}

function diffTables(label, generated, documented) {
  if (generated.join("\n") === documented.join("\n")) return true;
  console.error(`docs/EVAL.md ${label} table is out of date.\n`);
  const rows = Math.max(generated.length, documented.length);
  for (let i = 0; i < rows; i++) {
    const doc = documented[i] ?? "<missing>";
    const gen = generated[i] ?? "<missing>";
    if (doc !== gen) {
      console.error(`- ${doc}`);
      console.error(`+ ${gen}`);
    }
  }
  return false;
}

const regexTable = buildRegexTable();
const namePartsTable = buildNamePartsTable();

if (process.argv.includes("--check")) {
  const regexOk = diffTables("TypeScript regex", regexTable, documentedRegexTable());
  const partsOk = diffTables("TypeScript name-parts", namePartsTable, documentedNamePartsTable());
  if (regexOk && partsOk) {
    console.log("docs/EVAL.md TypeScript tables are up to date.");
    process.exit(0);
  }
  console.error(
    "\nRegenerate with: node scripts/eval-golden.mjs (in web/packages/core, after pnpm build)",
  );
  process.exit(1);
} else {
  console.log(regexTable.join("\n"));
  console.log("");
  console.log("## TypeScript core — name part splitting (heuristic)");
  console.log(namePartsTable.join("\n"));
}
