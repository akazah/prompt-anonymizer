/**
 * Node CLI (`npx @prompt-anonymizer/cli`) built on `@prompt-anonymizer/core`.
 *
 * Mirrors the Python CLI (`src/prompt_anonymizer/cli.py`): the same
 * `anonymize` / `deanonymize` / `version` commands, the same exit codes
 * (1 = error, 2 = aborted in interactive review) and the same `--json`
 * shape (`entity_type` keys, matching `AnonymizeResult.to_dict()`).
 *
 * Everything runs on-device: NER is transformers.js on the native CPU
 * backend (the model download from Hugging Face is the only network access,
 * as in the browser targets). The mapping is only written to disk when the
 * user explicitly passes `--mapping-file`.
 */

import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  Anonymizer,
  TransformersNerBackend,
  detectLanguage,
  type AnonymizeResult,
  type Language,
  type NerProgress,
} from "@prompt-anonymizer/core";

export interface CliIo {
  /** Write a line to stdout. */
  out(text: string): void;
  /** Write a line to stderr. */
  err(text: string): void;
  /** Read all of stdin (empty string when a TTY / nothing piped). */
  readStdin(): Promise<string>;
  /** Ask a Y/n question, re-prompting on invalid input. */
  confirm(prompt: string): Promise<boolean>;
}

/** Injectable for tests; the default engine is the real `Anonymizer`. */
export type EngineFactory = (options: { ner: boolean; io: CliIo }) => {
  anonymize(text: string, options: { language: Language }): Promise<AnonymizeResult>;
};

const NER_OFF_WARNING =
  "Warning: NER is off - names and locations will NOT be masked " +
  "(only emails, phone numbers, etc.).";

const USAGE = `prompt-anonymizer - Anonymize PII before it reaches an LLM.

Usage:
  prompt-anonymizer anonymize [-t TEXT | -f FILE | (stdin)] [options]
  prompt-anonymizer deanonymize --mapping-file FILE [-t TEXT | -f FILE | (stdin)]
  prompt-anonymizer version

anonymize options:
  -t, --text TEXT          Text to anonymize.
  -f, --file FILE          Read text from a file.
  -l, --language LANG      en, ja, es, vi or auto (default: auto).
      --no-ner             Disable the NER model (names/locations NOT masked).
      --json               Output JSON with text, mapping and entities.
  -i, --interactive        Review the result before printing.
      --mapping-file FILE  Write the label mapping to this JSON file.

deanonymize options:
  -t, --text TEXT          Text to restore.
  -f, --file FILE          Read text from a file.
      --mapping-file FILE  JSON file with the label mapping (required).
`;

class CliError extends Error {}

async function readInput(
  io: CliIo,
  text: string | undefined,
  file: string | undefined,
): Promise<string> {
  if (text !== undefined) return text;
  if (file !== undefined) return readFile(file, "utf-8");
  const data = await io.readStdin();
  if (data.trim()) return data;
  throw new CliError("Provide --text, --file, or pipe text via stdin.");
}

function resolveLanguage(value: string, text: string): Promise<Language> {
  if (value === "en" || value === "ja" || value === "es" || value === "vi") {
    return Promise.resolve(value);
  }
  if (value === "auto") return detectLanguage(text);
  throw new CliError(`Unsupported language: ${value} (use en, ja, es, vi or auto).`);
}

/** Same JSON shape as the Python CLI's `--json` (`AnonymizeResult.to_dict()`). */
export function resultToDict(result: AnonymizeResult): Record<string, unknown> {
  return {
    text: result.text,
    mapping: result.mapping,
    entities: result.entities.map((e) => ({
      start: e.start,
      end: e.end,
      entity_type: e.entityType,
      score: e.score,
    })),
  };
}

function defaultEngineFactory({ ner, io }: { ner: boolean; io: CliIo }): {
  anonymize(text: string, options: { language: Language }): Promise<AnonymizeResult>;
} {
  if (!ner) return new Anonymizer();
  const lastPrinted = new Map<string, number>();
  const onProgress = (p: NerProgress): void => {
    // Download progress goes to stderr so stdout stays pipeable.
    if (p.status !== "progress" || typeof p.progress !== "number" || !p.file) return;
    const step = Math.floor(p.progress / 25) * 25;
    if ((lastPrinted.get(p.file) ?? -1) >= step) return;
    lastPrinted.set(p.file, step);
    io.err(`Downloading model: ${p.file} ${step}%`);
  };
  // "cpu" = the native onnxruntime-node binding: transformers.js only
  // supports cuda/webgpu/cpu in Node, and "auto" would resolve to the
  // browser-only "wasm" device.
  return new Anonymizer({ ner: new TransformersNerBackend({ device: "cpu", onProgress }) });
}

async function runAnonymize(
  argv: string[],
  io: CliIo,
  engineFactory: EngineFactory,
): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    allowNegative: true,
    options: {
      text: { type: "string", short: "t" },
      file: { type: "string", short: "f" },
      language: { type: "string", short: "l", default: "auto" },
      ner: { type: "boolean", default: true },
      json: { type: "boolean", default: false },
      interactive: { type: "boolean", short: "i", default: false },
      "mapping-file": { type: "string" },
    },
  });

  const raw = await readInput(io, values.text, values.file);
  const language = await resolveLanguage(values.language, raw);
  if (!values.ner) io.err(NER_OFF_WARNING);

  const engine = engineFactory({ ner: values.ner, io });
  const result = await engine.anonymize(raw, { language });

  if (values.interactive) {
    io.out(`\n== Original ==\n${raw}\n\n== Anonymized ==\n${result.text}\n`);
    io.out("== Mapping ==");
    for (const [label, original] of Object.entries(result.mapping)) {
      io.out(`  ${label} -> ${original}`);
    }
    const ok = await io.confirm(
      "\nUse this result? Detection is best-effort - review carefully. (n)o,(Y)es > ",
    );
    if (!ok) {
      io.err("aborted");
      return 2;
    }
  }

  if (values["mapping-file"] !== undefined) {
    await writeFile(values["mapping-file"], JSON.stringify(result.mapping, null, 2), "utf-8");
  }

  io.out(values.json ? JSON.stringify(resultToDict(result), null, 2) : result.text);
  return 0;
}

async function runDeanonymize(argv: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      text: { type: "string", short: "t" },
      file: { type: "string", short: "f" },
      "mapping-file": { type: "string" },
    },
  });
  const mappingFile = values["mapping-file"];
  if (mappingFile === undefined) throw new CliError("--mapping-file is required.");

  const raw = await readInput(io, values.text, values.file);
  const mapping = JSON.parse(await readFile(mappingFile, "utf-8")) as Record<string, string>;
  const { deanonymize } = await import("@prompt-anonymizer/core");
  io.out(deanonymize(raw, mapping));
  return 0;
}

async function runVersion(io: CliIo): Promise<number> {
  const pkg = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf-8"),
  ) as { version: string };
  io.out(pkg.version);
  return 0;
}

export async function run(
  argv: string[],
  io: CliIo,
  engineFactory: EngineFactory = defaultEngineFactory,
): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case "anonymize":
        return await runAnonymize(rest, io, engineFactory);
      case "deanonymize":
        return await runDeanonymize(rest, io);
      case "version":
        return await runVersion(io);
      case undefined:
      case "help":
      case "--help":
      case "-h":
        io.out(USAGE);
        return command === undefined ? 1 : 0;
      default:
        io.err(`Unknown command: ${command}\n\n${USAGE}`);
        return 1;
    }
  } catch (error) {
    if (error instanceof CliError) {
      io.err(error.message);
      return 1;
    }
    throw error;
  }
}
