/**
 * MCP server (`npx @prompt-anonymizer/mcp`) built on `@prompt-anonymizer/core`.
 *
 * Exposes the anonymize → LLM → restore round-trip and the commit-time
 * `scan` gate as MCP tools, so any MCP client (Claude Desktop, Claude Code,
 * Cursor, …) can strip PII from text before it goes anywhere else.
 *
 * PII-handling contract (P0):
 * - `anonymize` keeps the label → original-value mapping in server memory
 *   and returns only a `mapping_id` by default. The mapping enters the
 *   model's context only when the caller explicitly opts in with
 *   `return_mapping: true`.
 * - `scan` reports `file:line:col` and the entity type only — never the
 *   matched text (same contract as both CLIs' `scan` subcommand).
 * - Nothing is persisted; mappings die with the server process.
 *
 * Everything runs on-device, as in the other targets: NER (opt-in via
 * `--ner`) is transformers.js on the native CPU backend, and the one-time
 * model download from Hugging Face is the only network access.
 */

import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Anonymizer,
  LANGUAGE_LIST,
  TransformersNerBackend,
  deanonymize,
  detectLanguage,
  isLanguage,
  isLanguageOption,
  type AnonymizeResult,
  type Language,
  type NerBackend,
  type NerProgress,
} from "@prompt-anonymizer/core";

export interface Engine {
  anonymize(text: string, options: { language: Language }): Promise<AnonymizeResult>;
}

/** Injectable for tests; the default engine is the real `Anonymizer`. */
export interface EngineOptions {
  ner: boolean;
  entities?: string[];
  denyList?: string[];
  allowList?: string[];
}
export type EngineFactory = (options: EngineOptions) => Engine;

export interface CreateServerOptions {
  /** Enable on-device NER (names/locations). Off by default: the first NER
   *  call downloads the model, which is surprising inside a tool call. */
  ner?: boolean;
  version?: string;
  engineFactory?: EngineFactory;
  /** Max mappings kept in memory before the oldest are evicted. */
  maxMappings?: number;
}

/** In-memory only; oldest-first eviction keeps memory bounded. */
class MappingStore {
  private readonly mappings = new Map<string, Record<string, string>>();

  constructor(private readonly maxEntries: number) {}

  put(mapping: Record<string, string>): string {
    const id = randomUUID();
    this.mappings.set(id, mapping);
    while (this.mappings.size > this.maxEntries) {
      const oldest = this.mappings.keys().next().value;
      if (oldest === undefined) break;
      this.mappings.delete(oldest);
    }
    return id;
  }

  get(id: string): Record<string, string> | undefined {
    return this.mappings.get(id);
  }
}

let sharedNer: NerBackend | undefined;

const defaultEngineFactory: EngineFactory = ({ ner, entities, denyList, allowList }) => {
  const entityOptions = entities !== undefined ? { entities } : {};
  if (!ner) return new Anonymizer({ ...entityOptions, denyList, allowList });
  // One backend for the server's lifetime so the model loads once.
  // "cpu" = the native onnxruntime-node binding (as in the Node CLI).
  sharedNer ??= new TransformersNerBackend({
    device: "cpu",
    onProgress: (p: NerProgress): void => {
      // stdout carries the MCP protocol; progress goes to stderr.
      if (p.status === "progress" && p.file && typeof p.progress === "number") {
        process.stderr.write(`Downloading model: ${p.file} ${Math.floor(p.progress)}%\n`);
      }
    },
  });
  return new Anonymizer({ ...entityOptions, ner: sharedNer, denyList, allowList });
};

async function resolveLanguage(value: string, text: string): Promise<Language> {
  if (isLanguage(value)) return value;
  if (value === "auto") return detectLanguage(text);
  throw new Error(`Unsupported language: ${value} (use ${LANGUAGE_LIST} or auto).`);
}

/** 1-based line and column of a character offset (parity with both CLIs). */
function lineCol(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  for (let i = 0; i < offset; i++) if (text[i] === "\n") line++;
  return { line, column: offset - text.lastIndexOf("\n", offset - 1) };
}

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

const languageSchema = z
  .string()
  .default("auto")
  .refine(isLanguageOption, {
    message: `Language must be one of ${LANGUAGE_LIST}, or auto.`,
  })
  .describe(`Language of the text: ${LANGUAGE_LIST}, or auto to detect.`);

export function createServer(options: CreateServerOptions = {}): McpServer {
  const ner = options.ner ?? false;
  const engineFactory = options.engineFactory ?? defaultEngineFactory;
  const store = new MappingStore(options.maxMappings ?? 1000);

  const server = new McpServer({
    name: "prompt-anonymizer",
    version: options.version ?? "0.0.0",
  });

  const nerNote = ner
    ? "Name/location NER is enabled."
    : "NER is off (server started without --ner): names and locations are NOT masked, " +
      "only structured PII (emails, phone numbers, postal codes, My Number, credit cards).";

  server.registerTool(
    "anonymize",
    {
      title: "Anonymize PII",
      description:
        "Replace PII in text with consistent, reversible labels (<Name_1>, <人名_1>, …) " +
        "so the text can be sent to an external service without exposing personal data. " +
        "Returns the anonymized text plus a mapping_id; the label → original-value " +
        "mapping stays in server memory and is NOT returned unless return_mapping is " +
        "true. Prefer `file` over `text` when the content lives on disk, so the " +
        "original PII never enters the conversation. " +
        nerNote,
      inputSchema: {
        text: z.string().optional().describe("Text to anonymize."),
        file: z
          .string()
          .optional()
          .describe("Path of a UTF-8 text file to anonymize instead of `text`."),
        language: languageSchema,
        entities: z
          .array(z.string())
          .optional()
          .describe(
            "Entity types to detect (default: built-in set). " +
              "Add US_SSN / IBAN_CODE to opt into those.",
          ),
        deny_list: z
          .array(z.string())
          .optional()
          .describe("Terms that must always be masked, e.g. project code names."),
        allow_list: z
          .array(z.string())
          .optional()
          .describe("Terms to leave unmasked even when detected."),
        return_mapping: z
          .boolean()
          .default(false)
          .describe(
            "Also return the label → original-value mapping. WARNING: this puts the " +
              "original PII into the model context; leave false unless you need to " +
              "persist the mapping yourself.",
          ),
      },
    },
    async (args): Promise<ToolResult> => {
      try {
        if ((args.text === undefined) === (args.file === undefined)) {
          return fail("Provide exactly one of `text` or `file`.");
        }
        const input = args.text ?? (await readFile(args.file as string, "utf-8"));
        const language = await resolveLanguage(args.language, input);
        const engine = engineFactory({
          ner,
          entities: args.entities,
          denyList: args.deny_list,
          allowList: args.allow_list,
        });
        const result = await engine.anonymize(input, { language });
        const mappingId = store.put(result.mapping);
        const entityCounts: Record<string, number> = {};
        for (const e of result.entities) {
          entityCounts[e.entityType] = (entityCounts[e.entityType] ?? 0) + 1;
        }
        return ok(
          JSON.stringify(
            {
              text: result.text,
              mapping_id: mappingId,
              entity_counts: entityCounts,
              ...(args.return_mapping ? { mapping: result.mapping } : {}),
            },
            null,
            2,
          ),
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "deanonymize",
    {
      title: "Restore anonymized text",
      description:
        "Restore the original values in text that contains labels from a previous " +
        "anonymize call (e.g. an LLM reply that kept the labels). Pass the mapping_id " +
        "returned by anonymize, or an explicit mapping object. With output_file the " +
        "restored text is written to disk and NOT returned, keeping the original PII " +
        "out of the model context.",
      inputSchema: {
        text: z.string().describe("Text containing labels such as <Name_1>."),
        mapping_id: z
          .string()
          .optional()
          .describe("mapping_id returned by a previous anonymize call on this server."),
        mapping: z
          .record(z.string(), z.string())
          .optional()
          .describe("Explicit label → original-value mapping (alternative to mapping_id)."),
        output_file: z
          .string()
          .optional()
          .describe("Write the restored text to this path instead of returning it."),
      },
    },
    async (args): Promise<ToolResult> => {
      try {
        const mapping =
          args.mapping ?? (args.mapping_id !== undefined ? store.get(args.mapping_id) : undefined);
        if (mapping === undefined) {
          return fail(
            args.mapping_id !== undefined
              ? `Unknown mapping_id: ${args.mapping_id} (mappings are in-memory and die with the server).`
              : "Provide mapping_id (from anonymize) or an explicit mapping.",
          );
        }
        const restored = deanonymize(args.text, mapping);
        if (args.output_file !== undefined) {
          await writeFile(args.output_file, restored, "utf-8");
          return ok(JSON.stringify({ written: args.output_file, length: restored.length }));
        }
        return ok(restored);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "scan",
    {
      title: "Scan for PII",
      description:
        "Check text or files for PII before committing, pushing or sending them " +
        "anywhere. Reports file:line:col and the entity type only — the matched text " +
        "is never included, so findings are safe to show. `clean` is true when " +
        "nothing was found. Offline, deterministic and model-free" +
        (ner ? " (plus NER, enabled on this server)" : "") +
        "; detects structured PII (emails, phone numbers, JP postal codes, My Number, " +
        "credit cards) and deny-list terms.",
      inputSchema: {
        text: z.string().optional().describe("Text to scan."),
        files: z
          .array(z.string())
          .optional()
          .describe("Paths of UTF-8 text files to scan instead of `text`."),
        language: languageSchema,
        deny_list: z
          .array(z.string())
          .optional()
          .describe("Terms that must never appear, e.g. project code names."),
        allow_list: z
          .array(z.string())
          .optional()
          .describe("Terms to ignore when detected."),
      },
    },
    async (args): Promise<ToolResult> => {
      try {
        const hasFiles = args.files !== undefined && args.files.length > 0;
        if ((args.text === undefined) === !hasFiles) {
          return fail("Provide exactly one of `text` or `files`.");
        }
        const inputs: Array<{ name: string; content: string }> = [];
        if (hasFiles) {
          for (const file of args.files as string[]) {
            inputs.push({ name: file, content: await readFile(file, "utf-8") });
          }
        } else {
          inputs.push({ name: "<text>", content: args.text as string });
        }
        const engine = engineFactory({
          ner,
          denyList: args.deny_list,
          allowList: args.allow_list,
        });
        const findings: Array<Record<string, unknown>> = [];
        for (const { name, content } of inputs) {
          const language = await resolveLanguage(args.language, content);
          const result = await engine.anonymize(content, { language });
          for (const span of result.entities) {
            const { line, column } = lineCol(content, span.start);
            findings.push({
              file: name,
              line,
              column,
              entity_type: span.entityType,
              score: span.score,
            });
          }
        }
        return ok(JSON.stringify({ clean: findings.length === 0, findings, inputs: inputs.length }));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },
  );

  return server;
}
