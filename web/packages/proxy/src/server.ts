/**
 * OpenAI-compatible anonymizing reverse proxy.
 *
 * PII is masked before any text leaves for the configured upstream; only
 * anonymized labels cross the wire. Mappings live in memory for the request
 * lifetime (or the capped event buffer when `recordMappings` is on) — never
 * logged, never persisted to disk. The admin API is DNS-rebinding guarded
 * when bound to loopback.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Anonymizer,
  LANGUAGE_LIST,
  TransformersNerBackend,
  deanonymize,
  detectLanguage,
  isLanguage,
  isLanguageOption,
  type Language,
} from "@prompt-anonymizer/core";
import type {
  AdminErrorResponse,
  EventMappingResponse,
  EventsResponse,
  PreviewRequest,
  PreviewResponse,
  ProxyConfig,
  ProxyStatus,
} from "./api-types.js";
import { RequestAnonymizer, type AnonymizeEngine } from "./anonymize-request.js";
import { ProxyState } from "./events.js";
import { StreamingRestorer } from "./restore-stream.js";

const UI_DIR = fileURLToPath(new URL("./ui/", import.meta.url));

const DEFAULT_CONFIG: ProxyConfig = {
  upstreamUrl: "https://api.openai.com",
  ner: true,
  language: "auto",
  denyList: [],
  allowList: [],
  recordMappings: false,
};

const UPSTREAM_FETCH_TIMEOUT_MS = 10_000;

const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-length",
  "accept-encoding",
  "upgrade",
  "proxy-authorization",
  "te",
  "trailer",
]);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export interface ProxyServerOptions {
  host?: string;
  port?: number;
  config?: Partial<ProxyConfig>;
  engineFactory?: (config: ProxyConfig) => AnonymizeEngine;
  version?: string;
  log?: (line: string) => void;
}

export interface ProxyServer {
  server: Server;
  url: string;
  close(): Promise<void>;
}

interface TextContentPart {
  type: string;
  text?: string;
}

interface ChatMessage {
  role?: string;
  content?: string | TextContentPart[];
  [key: string]: unknown;
}

interface ChatCompletionBody {
  model?: string;
  messages?: unknown;
  stream?: boolean;
  [key: string]: unknown;
}

interface ChoiceMessage {
  content?: string | TextContentPart[];
  [key: string]: unknown;
}

interface ChoiceDelta {
  content?: string;
  [key: string]: unknown;
}

interface ChatChoice {
  index?: number;
  message?: ChoiceMessage;
  delta?: ChoiceDelta;
  finish_reason?: string | null;
  [key: string]: unknown;
}

interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: ChatChoice[];
  [key: string]: unknown;
}

function defaultEngineFactory(config: ProxyConfig): AnonymizeEngine {
  if (!config.ner) return new Anonymizer({ denyList: config.denyList, allowList: config.allowList });
  return new Anonymizer({
    ner: new TransformersNerBackend({ device: "cpu" }),
    denyList: config.denyList,
    allowList: config.allowList,
  });
}

function upstreamFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(UPSTREAM_FETCH_TIMEOUT_MS),
  });
}

function isLoopbackBind(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
}

function hostHeaderAllowed(bindHost: string, hostHeader: string | undefined): boolean {
  if (!isLoopbackBind(bindHost)) return true;
  const name = (hostHeader ?? "").split(":")[0]!.toLowerCase();
  return name === "localhost" || name === "127.0.0.1" || name === "[::1]";
}

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload).toString(),
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function filterHeaders(headers: IncomingMessage["headers"]): Record<string, string> {
  const out: Record<string, string> = { "accept-encoding": "identity" };
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    out[lower] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

async function resolveLanguage(
  configLang: ProxyConfig["language"],
  text: string,
): Promise<Language> {
  if (isLanguage(configLang)) return configLang;
  return detectLanguage(text);
}

function collectMessageText(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  const parts: string[] = [];
  for (const msg of messages) {
    if (typeof msg !== "object" || msg === null) continue;
    const content = (msg as ChatMessage).content;
    if (typeof content === "string") {
      parts.push(content);
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (
          typeof part === "object" &&
          part !== null &&
          part.type === "text" &&
          typeof part.text === "string"
        ) {
          parts.push(part.text);
        }
      }
    }
  }
  return parts.join("\n");
}

async function anonymizeMessages(
  messages: unknown,
  anonymizer: RequestAnonymizer,
): Promise<unknown> {
  if (!Array.isArray(messages)) return messages;
  const out: unknown[] = [];
  for (const msg of messages) {
    if (typeof msg !== "object" || msg === null) {
      out.push(msg);
      continue;
    }
    const copy: ChatMessage = { ...(msg as ChatMessage) };
    if (typeof copy.content === "string") {
      copy.content = await anonymizer.anonymize(copy.content);
    } else if (Array.isArray(copy.content)) {
      copy.content = await Promise.all(
        copy.content.map(async (part) => {
          if (typeof part !== "object" || part === null) return part;
          if (part.type === "text" && typeof part.text === "string") {
            return { ...part, text: await anonymizer.anonymize(part.text) };
          }
          return part;
        }),
      );
    }
    out.push(copy);
  }
  return out;
}

function restoreStringContent(text: string, mapping: Record<string, string>): string {
  return deanonymize(text, mapping);
}

function restoreMessageContent(
  content: string | TextContentPart[] | undefined,
  mapping: Record<string, string>,
): string | TextContentPart[] | undefined {
  if (typeof content === "string") return restoreStringContent(content, mapping);
  if (!Array.isArray(content)) return content;
  return content.map((part) => {
    if (part.type === "text" && typeof part.text === "string") {
      return { ...part, text: restoreStringContent(part.text, mapping) };
    }
    return part;
  });
}

function restoreCompletionResponse(
  data: ChatCompletionResponse,
  mapping: Record<string, string>,
): ChatCompletionResponse {
  if (!Array.isArray(data.choices)) return data;
  return {
    ...data,
    choices: data.choices.map((choice) => {
      const next: ChatChoice = { ...choice };
      if (next.message !== undefined) {
        next.message = {
          ...next.message,
          content: restoreMessageContent(next.message.content, mapping),
        };
      }
      if (typeof next.delta?.content === "string") {
        next.delta = {
          ...next.delta,
          content: restoreStringContent(next.delta.content, mapping),
        };
      }
      return next;
    }),
  };
}

function validateConfigPatch(
  patch: unknown,
): { ok: true; patch: Partial<ProxyConfig> } | { ok: false; error: string } {
  if (typeof patch !== "object" || patch === null) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const body = patch as Record<string, unknown>;
  const out: Partial<ProxyConfig> = {};

  if ("upstreamUrl" in body) {
    if (typeof body.upstreamUrl !== "string") {
      return { ok: false, error: "upstreamUrl must be a string." };
    }
    try {
      const url = new URL(body.upstreamUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { ok: false, error: "upstreamUrl must be http or https." };
      }
      out.upstreamUrl = body.upstreamUrl;
    } catch {
      return { ok: false, error: "upstreamUrl is not a valid URL." };
    }
  }

  if ("ner" in body) {
    if (typeof body.ner !== "boolean") return { ok: false, error: "ner must be a boolean." };
    out.ner = body.ner;
  }

  if ("language" in body) {
    if (!isLanguageOption(body.language)) {
      return { ok: false, error: `language must be ${LANGUAGE_LIST} or auto.` };
    }
    out.language = body.language;
  }

  if ("denyList" in body) {
    if (!Array.isArray(body.denyList) || body.denyList.some((v) => typeof v !== "string")) {
      return { ok: false, error: "denyList must be an array of strings." };
    }
    out.denyList = [...body.denyList];
  }

  if ("allowList" in body) {
    if (!Array.isArray(body.allowList) || body.allowList.some((v) => typeof v !== "string")) {
      return { ok: false, error: "allowList must be an array of strings." };
    }
    out.allowList = [...body.allowList];
  }

  if ("recordMappings" in body) {
    if (typeof body.recordMappings !== "boolean") {
      return { ok: false, error: "recordMappings must be a boolean." };
    }
    out.recordMappings = body.recordMappings;
  }

  return { ok: true, patch: out };
}

function engineNeedsRebuild(
  prev: ProxyConfig,
  next: ProxyConfig,
): boolean {
  return (
    prev.ner !== next.ner ||
    prev.denyList.join("\0") !== next.denyList.join("\0") ||
    prev.allowList.join("\0") !== next.allowList.join("\0")
  );
}

async function serveStaticAdmin(
  res: ServerResponse,
  pathname: string,
): Promise<void> {
  if (!existsSync(UI_DIR)) {
    jsonResponse(res, 404, {
      error:
        "Admin UI not built. Run `pnpm build` in @prompt-anonymizer/proxy to compile dist/ui.",
    } satisfies AdminErrorResponse);
    return;
  }

  let rel = pathname.replace(/^\/admin\/?/, "") || "index.html";
  if (rel.endsWith("/")) rel += "index.html";

  const filePath = normalize(join(UI_DIR, rel));
  if (!filePath.startsWith(UI_DIR)) {
    jsonResponse(res, 403, { error: "Forbidden." } satisfies AdminErrorResponse);
    return;
  }

  const tryPaths = existsSync(filePath) && statSync(filePath).isFile()
    ? [filePath]
    : [join(UI_DIR, "index.html")];

  const target = tryPaths[0]!;
  const ext = extname(target).toLowerCase();
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  res.writeHead(200, { "content-type": mime });
  createReadStream(target).pipe(res);
}

function wrapEngine(
  engine: AnonymizeEngine,
  state: ProxyState,
  config: ProxyConfig,
): AnonymizeEngine {
  if (!config.ner) return engine;
  return {
    async anonymize(text, options) {
      const result = await engine.anonymize(text, options);
      state.nerReady = true;
      return result;
    },
  };
}

export async function startProxyServer(
  options: ProxyServerOptions = {},
): Promise<ProxyServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 8787;
  const log = options.log ?? ((line: string) => console.error(line));

  const config: ProxyConfig = { ...DEFAULT_CONFIG, ...options.config };
  const factory = options.engineFactory ?? defaultEngineFactory;

  const version =
    options.version ??
    (
      JSON.parse(
        await readFile(new URL("../package.json", import.meta.url), "utf-8"),
      ) as { version: string }
    ).version;

  const state = new ProxyState(config, !config.ner);
  let engine = wrapEngine(factory(config), state, config);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;
    const method = req.method ?? "GET";

    try {
      if (pathname === "/healthz" && method === "GET") {
        jsonResponse(res, 200, { ok: true });
        return;
      }

      if (pathname.startsWith("/admin")) {
        if (!hostHeaderAllowed(host, req.headers.host)) {
          jsonResponse(res, 403, { error: "Forbidden host." } satisfies AdminErrorResponse);
          return;
        }

        if (pathname === "/admin/api/status" && method === "GET") {
          const status: ProxyStatus = {
            version,
            uptimeSeconds: Math.floor((Date.now() - state.startTime) / 1000),
            host,
            port: (server.address() as { port: number }).port,
            config: { ...state.config },
            nerReady: state.nerReady,
            requests: { ...state.requests },
          };
          jsonResponse(res, 200, status);
          return;
        }

        if (pathname === "/admin/api/config") {
          if (method === "GET") {
            jsonResponse(res, 200, { ...state.config });
            return;
          }
          if (method === "PUT") {
            let body: unknown;
            try {
              body = JSON.parse((await readBody(req)).toString("utf-8"));
            } catch {
              jsonResponse(res, 400, { error: "Invalid JSON." } satisfies AdminErrorResponse);
              return;
            }
            const validated = validateConfigPatch(body);
            if (!validated.ok) {
              jsonResponse(res, 400, { error: validated.error } satisfies AdminErrorResponse);
              return;
            }
            const prev = state.config;
            const next: ProxyConfig = { ...state.config, ...validated.patch };
            if (engineNeedsRebuild(prev, next)) {
              engine = wrapEngine(factory(next), state, next);
              if (!next.ner) state.nerReady = true;
              else if (prev.ner !== next.ner) state.nerReady = false;
            }
            if (prev.recordMappings && !next.recordMappings) {
              state.clearMappings();
            }
            state.config = next;
            jsonResponse(res, 200, { ...state.config });
            return;
          }
        }

        if (pathname === "/admin/api/events" && method === "GET") {
          const limitRaw = url.searchParams.get("limit");
          let limit = limitRaw === null ? 50 : Number.parseInt(limitRaw, 10);
          if (!Number.isFinite(limit) || limit < 1) limit = 50;
          if (limit > 100) limit = 100;
          const response: EventsResponse = { events: state.snapshotEvents(limit) };
          jsonResponse(res, 200, response);
          return;
        }

        const mappingMatch = /^\/admin\/api\/events\/(\d+)\/mapping$/.exec(pathname);
        if (mappingMatch && method === "GET") {
          const id = Number.parseInt(mappingMatch[1]!, 10);
          const mapping = state.getMapping(id);
          if (mapping === null) {
            jsonResponse(res, 404, { error: "Mapping not found." } satisfies AdminErrorResponse);
            return;
          }
          const response: EventMappingResponse = { id, mapping };
          jsonResponse(res, 200, response);
          return;
        }

        if (pathname === "/admin/api/preview" && method === "POST") {
          let body: unknown;
          try {
            body = JSON.parse((await readBody(req)).toString("utf-8"));
          } catch {
            jsonResponse(res, 400, { error: "Invalid JSON." } satisfies AdminErrorResponse);
            return;
          }
          if (typeof body !== "object" || body === null || typeof (body as PreviewRequest).text !== "string") {
            jsonResponse(res, 400, { error: "text is required." } satisfies AdminErrorResponse);
            return;
          }
          const previewBody = body as PreviewRequest;
          const lang = await resolveLanguage(previewBody.language ?? state.config.language, previewBody.text);
          const result = await engine.anonymize(previewBody.text, { language: lang });
          const response: PreviewResponse = {
            text: previewBody.text,
            anonymized: result.text,
            mapping: result.mapping,
            entities: result.entities.map((e) => ({
              start: e.start,
              end: e.end,
              entity_type: e.entityType,
              score: e.score,
            })),
            language: lang,
          };
          jsonResponse(res, 200, response);
          return;
        }

        if (pathname.startsWith("/admin/api/")) {
          jsonResponse(res, 404, { error: "Not found." } satisfies AdminErrorResponse);
          return;
        }

        if (pathname === "/admin" || pathname === "/admin/" || pathname.startsWith("/admin/")) {
          await serveStaticAdmin(res, pathname);
          return;
        }
      }

      if (pathname.startsWith("/v1/")) {
        const upstreamBase = state.config.upstreamUrl.replace(/\/$/, "");
        const upstreamUrl = `${upstreamBase}${pathname}${url.search}`;
        const headers = filterHeaders(req.headers);
        const startMs = Date.now();

        if (method === "POST" && pathname === "/v1/chat/completions") {
          let rawBody: Buffer;
          try {
            rawBody = await readBody(req);
          } catch {
            state.requests.errors++;
            jsonResponse(res, 500, { error: "Failed to read request body." });
            return;
          }

          let body: ChatCompletionBody;
          try {
            body = JSON.parse(rawBody.toString("utf-8")) as ChatCompletionBody;
          } catch {
            state.requests.errors++;
            jsonResponse(res, 400, { error: "Invalid JSON body." });
            return;
          }

          const stream = body.stream === true;
          const language = await resolveLanguage(
            state.config.language,
            collectMessageText(body.messages),
          );

          const anonymizer = new RequestAnonymizer(engine, language);
          const anonymizedBody: ChatCompletionBody = {
            ...body,
            messages: await anonymizeMessages(body.messages, anonymizer),
          };
          const mapping = { ...anonymizer.mapping };
          const labels = Object.keys(mapping);
          const entityCounts = { ...anonymizer.entityCounts };

          let upstreamStatus: number | undefined;
          let eventStatus: "ok" | "upstream_error" | "error" = "ok";

          try {
            const upstreamRes = await upstreamFetch(upstreamUrl, {
              method: "POST",
              headers: {
                ...headers,
                "content-type": "application/json",
              },
              body: JSON.stringify(anonymizedBody),
            });

            upstreamStatus = upstreamRes.status;
            if (!upstreamRes.ok) eventStatus = "upstream_error";

            const contentType = upstreamRes.headers.get("content-type") ?? "";

            if (contentType.includes("text/event-stream")) {
              res.writeHead(upstreamRes.status, {
                "content-type": "text/event-stream",
                "cache-control": "no-cache",
                connection: "keep-alive",
              });

              const restorer = new StreamingRestorer(mapping);
              let sseBuffer = "";
              let lastChunk: ChatCompletionResponse | null = null;

              const reader = upstreamRes.body?.getReader();
              if (!reader) {
                res.end();
              } else {
                const decoder = new TextDecoder();
                let done = false;
                while (!done) {
                  const read = await reader.read();
                  done = read.done;
                  if (read.value) sseBuffer += decoder.decode(read.value, { stream: !done });

                  let sep = sseBuffer.indexOf("\n\n");
                  while (sep !== -1) {
                    const block = sseBuffer.slice(0, sep);
                    sseBuffer = sseBuffer.slice(sep + 2);
                    const lines = block.split("\n");
                    const dataLines = lines.filter((l) => l.startsWith("data: "));
                    if (dataLines.length === 0) {
                      sep = sseBuffer.indexOf("\n\n");
                      continue;
                    }
                    const payload = dataLines.map((l) => l.slice(6)).join("\n");

                    if (payload === "[DONE]") {
                      const flushed = restorer.flush();
                      if (flushed.length > 0 && lastChunk !== null) {
                        const synthetic: ChatCompletionResponse = {
                          id: lastChunk.id,
                          model: lastChunk.model,
                          choices: [
                            {
                              index: lastChunk.choices?.[0]?.index ?? 0,
                              delta: { content: flushed },
                              finish_reason: null,
                            },
                          ],
                        };
                        res.write(`data: ${JSON.stringify(synthetic)}\n\n`);
                      }
                      res.write("data: [DONE]\n\n");
                    } else {
                      try {
                        const parsed = JSON.parse(payload) as ChatCompletionResponse;
                        lastChunk = parsed;
                        const deltaContent = parsed.choices?.[0]?.delta?.content;
                        if (typeof deltaContent === "string" && deltaContent.length > 0) {
                          const restored = restorer.push(deltaContent);
                          const out: ChatCompletionResponse = {
                            ...parsed,
                            choices: parsed.choices?.map((c, i) =>
                              i === 0
                                ? { ...c, delta: { ...c.delta, content: restored } }
                                : c,
                            ),
                          };
                          res.write(`data: ${JSON.stringify(out)}\n\n`);
                        } else {
                          res.write(`data: ${payload}\n\n`);
                        }
                      } catch {
                        res.write(`data: ${payload}\n\n`);
                      }
                    }
                    sep = sseBuffer.indexOf("\n\n");
                  }
                }
                res.end();
              }
            } else if (contentType.includes("application/json")) {
              const text = await upstreamRes.text();
              let parsed: ChatCompletionResponse;
              try {
                parsed = JSON.parse(text) as ChatCompletionResponse;
              } catch {
                res.writeHead(upstreamRes.status, { "content-type": contentType });
                res.end(text);
                state.requests.anonymized++;
                state.addEvent(
                  {
                    timestamp: new Date().toISOString(),
                    method,
                    path: pathname,
                    model: typeof body.model === "string" ? body.model : undefined,
                    language,
                    stream,
                    entityCounts,
                    labels,
                    durationMs: Date.now() - startMs,
                    status: eventStatus,
                    upstreamStatus,
                    mapping,
                  },
                  state.config.recordMappings,
                );
                return;
              }
              const restored = restoreCompletionResponse(parsed, mapping);
              const payload = JSON.stringify(restored);
              res.writeHead(upstreamRes.status, {
                "content-type": "application/json; charset=utf-8",
                "content-length": Buffer.byteLength(payload).toString(),
              });
              res.end(payload);
            } else {
              const buf = Buffer.from(await upstreamRes.arrayBuffer());
              res.writeHead(upstreamRes.status, {
                "content-type": contentType || "application/octet-stream",
              });
              res.end(buf);
            }

            state.requests.anonymized++;
            state.addEvent(
              {
                timestamp: new Date().toISOString(),
                method,
                path: pathname,
                model: typeof body.model === "string" ? body.model : undefined,
                language,
                stream,
                entityCounts,
                labels,
                durationMs: Date.now() - startMs,
                status: eventStatus,
                upstreamStatus,
                mapping,
              },
              state.config.recordMappings,
            );
          } catch {
            state.requests.errors++;
            state.addEvent(
              {
                timestamp: new Date().toISOString(),
                method,
                path: pathname,
                model: typeof body.model === "string" ? body.model : undefined,
                language,
                stream,
                entityCounts,
                labels,
                durationMs: Date.now() - startMs,
                status: "upstream_error",
                mapping,
              },
              state.config.recordMappings,
            );
            jsonResponse(res, 502, { error: "Upstream request failed." });
          }
          return;
        }

        // Passthrough for other /v1/* routes
        const rawBody = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
        try {
          const upstreamRes = await upstreamFetch(upstreamUrl, {
            method,
            headers,
            body: rawBody,
            duplex: rawBody !== undefined ? "half" : undefined,
          } as RequestInit);

          const passthroughHeaders: Record<string, string> = {};
          upstreamRes.headers.forEach((value, key) => {
            if (!HOP_BY_HOP.has(key.toLowerCase())) passthroughHeaders[key] = value;
          });
          res.writeHead(upstreamRes.status, passthroughHeaders);
          if (upstreamRes.body) {
            const reader = upstreamRes.body.getReader();
            let done = false;
            while (!done) {
              const read = await reader.read();
              done = read.done;
              if (read.value) res.write(Buffer.from(read.value));
            }
          }
          res.end();
          state.requests.passthrough++;
          state.addEvent(
            {
              timestamp: new Date().toISOString(),
              method,
              path: pathname,
              language: state.config.language === "auto" ? "en" : state.config.language,
              stream: false,
              entityCounts: {},
              labels: [],
              durationMs: Date.now() - startMs,
              status: upstreamRes.ok ? "ok" : "upstream_error",
              upstreamStatus: upstreamRes.status,
            },
            false,
          );
        } catch {
          state.requests.errors++;
          state.addEvent(
            {
              timestamp: new Date().toISOString(),
              method,
              path: pathname,
              language: state.config.language === "auto" ? "en" : state.config.language,
              stream: false,
              entityCounts: {},
              labels: [],
              durationMs: Date.now() - startMs,
              status: "upstream_error",
            },
            false,
          );
          jsonResponse(res, 502, { error: "Upstream request failed." });
        }
        return;
      }

      jsonResponse(res, 404, { error: "Not found." } satisfies AdminErrorResponse);
    } catch {
      state.requests.errors++;
      jsonResponse(res, 500, { error: "Internal server error." });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const addr = server.address();
  const actualPort = typeof addr === "object" && addr !== null ? addr.port : port;
  const url = `http://${host === "::1" || host === "[::1]" ? "[::1]" : host}:${actualPort}`;

  log(`proxy listening on ${url}`);
  log(`admin GUI: ${url}/admin/`);

  return {
    server,
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
