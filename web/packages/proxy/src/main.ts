/**
 * Node CLI (`npx @prompt-anonymizer/proxy`) for the anonymizing reverse proxy.
 *
 * The proxy masks PII before text reaches the configured upstream LLM API.
 * Only anonymized labels leave the device; mappings stay in memory for the
 * request lifetime (or the capped event buffer when `--record-mappings` is on).
 * Request text and mappings are never logged.
 */

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { startProxyServer } from "./server.js";

export interface ProxyIo {
  out(text: string): void;
  err(text: string): void;
}

const NER_OFF_WARNING =
  "Warning: NER is off - names and locations will NOT be masked " +
  "(only emails, phone numbers, etc.).";

const USAGE = `prompt-anonymizer-proxy [options]
  -p, --port PORT        Listen port (default: 8787)
      --host HOST        Bind address (default: 127.0.0.1; use 0.0.0.0 at your own risk)
  -u, --upstream URL     OpenAI-compatible upstream base URL (default: https://api.openai.com)
  -l, --language LANG    en, ja, es, vi or auto (default: auto)
      --no-ner           Disable the NER model (names/locations NOT masked)
      --deny VALUE       Always mask VALUE (repeatable)
      --allow VALUE      Never mask VALUE (repeatable)
      --record-mappings  Keep per-request mappings in memory so the admin GUI can reveal originals
      --version          Print the package version
  -h, --help             Show this help
`;

class CliError extends Error {}

export async function run(argv: string[], io: ProxyIo): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    allowNegative: true,
    options: {
      port: { type: "string", short: "p", default: "8787" },
      host: { type: "string", default: "127.0.0.1" },
      upstream: { type: "string", short: "u", default: "https://api.openai.com" },
      language: { type: "string", short: "l", default: "auto" },
      ner: { type: "boolean", default: true },
      deny: { type: "string", multiple: true, default: [] },
      allow: { type: "string", multiple: true, default: [] },
      "record-mappings": { type: "boolean", default: false },
      version: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    io.out(USAGE);
    return 0;
  }

  if (values.version) {
    const pkg = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf-8"),
    ) as { version: string };
    io.out(pkg.version);
    return 0;
  }

  const language = values.language;
  if (
    language !== "auto" &&
    language !== "en" &&
    language !== "ja" &&
    language !== "es" &&
    language !== "vi"
  ) {
    throw new CliError(`Unsupported language: ${language} (use en, ja, es, vi or auto).`);
  }

  const port = Number.parseInt(values.port, 10);
  if (!Number.isFinite(port) || port < 0 || port > 65535) {
    throw new CliError(`Invalid port: ${values.port}`);
  }

  if (!values.ner) io.err(NER_OFF_WARNING);

  const denyList = values.deny ?? [];
  const allowList = values.allow ?? [];

  const proxy = await startProxyServer({
    host: values.host,
    port,
    config: {
      upstreamUrl: values.upstream,
      ner: values.ner,
      language,
      denyList,
      allowList,
      recordMappings: values["record-mappings"],
    },
    log: io.err,
  });

  const addr = proxy.server.address();
  const actualPort =
    typeof addr === "object" && addr !== null ? addr.port : port;
  const displayHost = values.host === "0.0.0.0" ? "127.0.0.1" : values.host;
  const baseUrl = `http://${displayHost}:${actualPort}`;

  io.err(`OpenAI-compatible endpoint: ${baseUrl}/v1`);
  io.err(`Set OPENAI_BASE_URL=${baseUrl}/v1 in your client.`);

  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      void proxy.close().then(resolve);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });

  return 0;
}

export async function runCli(argv: string[], io: ProxyIo): Promise<number> {
  try {
    return await run(argv, io);
  } catch (error) {
    if (error instanceof CliError) {
      io.err(error.message);
      return 1;
    }
    throw error;
  }
}
