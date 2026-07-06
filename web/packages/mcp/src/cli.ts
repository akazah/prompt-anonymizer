#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const USAGE = `prompt-anonymizer-mcp - MCP server: anonymize PII before it reaches an LLM.

Usage:
  prompt-anonymizer-mcp [--ner]

Options:
  --ner        Also detect names/locations with the on-device NER model
               (off by default; the first call downloads the model).
  --version    Print the version and exit.
  -h, --help   Show this help.

Tools exposed over stdio: anonymize, deanonymize, scan.
The label mapping stays in server memory (mapping_id) and is never persisted.
`;

async function version(): Promise<string> {
  const pkg = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf-8"),
  ) as { version: string };
  return pkg.version;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      ner: { type: "boolean", default: false },
      version: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (values.version) {
    process.stdout.write(`${await version()}\n`);
    return;
  }
  if (!values.ner) {
    process.stderr.write(
      "NER is off - names and locations will NOT be masked (pass --ner to enable).\n",
    );
  }
  const server = createServer({ ner: values.ner, version: await version() });
  await server.connect(new StdioServerTransport());
  process.stderr.write("prompt-anonymizer MCP server listening on stdio\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
