import { createServer, type IncomingMessage, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { Anonymizer } from "@prompt-anonymizer/core";
import { startProxyServer, type ProxyServer } from "../src/server.js";

interface UpstreamCapture {
  method?: string;
  path?: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

function readReq(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

async function startMockUpstream(
  handler: (capture: UpstreamCapture, req: IncomingMessage, res: import("node:http").ServerResponse) => void | Promise<void>,
): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const capture: UpstreamCapture = {
        method: req.method,
        path: req.url,
        headers: req.headers,
        body: await readReq(req),
      };
      await handler(capture, req, res);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; body: unknown; text: string }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: res.status, body, text };
}

const regexEngine = () => new Anonymizer();

let proxy: ProxyServer | undefined;
let upstream: Server | undefined;

afterEach(async () => {
  if (proxy) {
    proxy.server.closeAllConnections();
    await proxy.close();
  }
  if (upstream) {
    await new Promise<void>((resolve, reject) => upstream!.close((e) => (e ? reject(e) : resolve())));
  }
  proxy = undefined;
  upstream = undefined;
});

describe("proxy e2e", () => {
  it("anonymizes outbound chat completions and restores inbound JSON", async () => {
    const email = "secret@example.com";
    const phone = "090-1234-5678";

    const mock = await startMockUpstream((capture, _req, res) => {
      const parsed = JSON.parse(capture.body) as {
        messages: Array<{ content: string }>;
      };
      const joined = parsed.messages.map((m) => m.content).join(" ");
      expect(joined).not.toContain(email);
      expect(joined).not.toContain(phone);
      expect(joined).toMatch(/<メールアドレス_\d+>/);
      expect(joined).toMatch(/<電話番号_\d+>/);
      expect(capture.headers.authorization).toBe("Bearer test-key");

      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: `確認: ${joined}`,
              },
            },
          ],
        }),
      );
    });
    upstream = mock.server;

    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl: mock.url, ner: false, language: "ja" },
    });

    const { status, body } = await fetchJson(`${proxy.url}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-key",
      },
      body: JSON.stringify({
        model: "gpt-test",
        messages: [{ role: "user", content: `連絡 ${email} / ${phone}` }],
      }),
    });

    expect(status).toBe(200);
    const content = (body as { choices: Array<{ message: { content: string } }> }).choices[0]!
      .message.content;
    expect(content).toContain(email);
    expect(content).toContain(phone);
    expect(content).not.toMatch(/<メールアドレス_\d+>/);
  });

  it("restores streaming SSE when a label spans two data events", async () => {
    const email = "alice@example.com";
    let upstreamLabel = "";

    const mock = await startMockUpstream((capture, _req, res) => {
      const parsed = JSON.parse(capture.body) as { messages: Array<{ content: string }> };
      upstreamLabel = parsed.messages[0]!.content;
      expect(upstreamLabel).not.toContain(email);

      const mid = Math.max(1, Math.floor(upstreamLabel.length / 2));
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(
        `data: ${JSON.stringify({ id: "x", model: "m", choices: [{ index: 0, delta: { content: "Reply " } }] })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({ id: "x", model: "m", choices: [{ index: 0, delta: { content: upstreamLabel.slice(0, mid) } }] })}\n\n`,
      );
      res.write(
        `data: ${JSON.stringify({ id: "x", model: "m", choices: [{ index: 0, delta: { content: upstreamLabel.slice(mid) } }] })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      res.end();
    });
    upstream = mock.server;

    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl: mock.url, ner: false, language: "en" },
    });

    const res = await fetch(`${proxy.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-test",
        messages: [{ role: "user", content: `Email: ${email}` }],
        stream: true,
      }),
    });

    const text = await res.text();
    expect(text).toContain("Reply ");
    expect(text).toContain(email);
    expect(text).toContain("data: [DONE]");
    expect(text).not.toContain(upstreamLabel);
  });

  it("passthroughs GET /v1/models verbatim", async () => {
    const mock = await startMockUpstream((capture, _req, res) => {
      expect(capture.method).toBe("GET");
      expect(capture.path).toBe("/v1/models");
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"data":[]}');
    });
    upstream = mock.server;

    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl: mock.url, ner: false },
    });

    const { status, text } = await fetchJson(`${proxy.url}/v1/models`);
    expect(status).toBe(200);
    expect(text).toBe('{"data":[]}');

    const events = await fetchJson(`${proxy.url}/admin/api/events?limit=1`);
    const event = (events.body as { events: Array<{ path: string; entityCounts: Record<string, number> }> })
      .events[0]!;
    expect(event.path).toBe("/v1/models");
    expect(event.entityCounts).toEqual({});

    const statusRes = await fetchJson(`${proxy.url}/admin/api/status`);
    expect((statusRes.body as { requests: { passthrough: number } }).requests.passthrough).toBeGreaterThanOrEqual(1);
  });

  it("returns 502 when upstream is unreachable", async () => {
    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl: "http://127.0.0.1:9", ner: false },
      log: () => {},
    });

    const { status, body } = await fetchJson(`${proxy.url}/v1/models`);
    expect(status).toBe(502);
    expect((body as { error: string }).error).toBeTruthy();

    const events = await fetchJson(`${proxy.url}/admin/api/events?limit=1`);
    expect((events.body as { events: Array<{ status: string }> }).events[0]!.status).toBe("upstream_error");
  });
});
