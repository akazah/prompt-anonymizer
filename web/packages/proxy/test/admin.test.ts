import { createServer, request, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { Anonymizer } from "@prompt-anonymizer/core";
import { startProxyServer, type ProxyServer } from "../src/server.js";

const regexEngine = () => new Anonymizer();

let proxy: ProxyServer | undefined;
let upstream: Server | undefined;

afterEach(async () => {
  await proxy?.close();
  if (upstream) {
    await new Promise<void>((resolve, reject) => upstream!.close((e) => (e ? reject(e) : resolve())));
  }
  proxy = undefined;
  upstream = undefined;
});

async function startUpstream(): Promise<string> {
  return new Promise((resolve) => {
    upstream = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"choices":[{"message":{"content":"ok"}}]}');
    });
    upstream.listen(0, "127.0.0.1", () => {
      const addr = upstream!.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function json(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, init);
  return { status: res.status, body: await res.json() };
}

describe("admin API", () => {
  it("returns status shape", async () => {
    const upstreamUrl = await startUpstream();
    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl, ner: false },
      version: "9.9.9-test",
    });

    const { status, body } = await json(`${proxy.url}/admin/api/status`);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      version: "9.9.9-test",
      host: "127.0.0.1",
      nerReady: true,
      requests: { total: 0, anonymized: 0, passthrough: 0, errors: 0 },
      config: { upstreamUrl, ner: false, language: "auto", recordMappings: false },
    });
    expect((body as { uptimeSeconds: number }).uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("validates config PUT and round-trips", async () => {
    const upstreamUrl = await startUpstream();
    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl, ner: false },
    });

    const badLang = await json(`${proxy.url}/admin/api/config`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: "xx" }),
    });
    expect(badLang.status).toBe(400);

    const badUrl = await json(`${proxy.url}/admin/api/config`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ upstreamUrl: "not-a-url" }),
    });
    expect(badUrl.status).toBe(400);

    const ok = await json(`${proxy.url}/admin/api/config`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: "en", denyList: ["Acme"] }),
    });
    expect(ok.status).toBe(200);
    expect((ok.body as { language: string; denyList: string[] }).language).toBe("en");
    expect((ok.body as { denyList: string[] }).denyList).toEqual(["Acme"]);

    const got = await json(`${proxy.url}/admin/api/config`);
    expect(got.body).toEqual(ok.body);
  });

  it("accepts every registry language in config PUT", async () => {
    const upstreamUrl = await startUpstream();
    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl, ner: false },
    });

    const ok = await json(`${proxy.url}/admin/api/config`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: "vi" }),
    });
    expect(ok.status).toBe(200);
    expect((ok.body as { language: string }).language).toBe("vi");

    const got = await json(`${proxy.url}/admin/api/config`);
    expect((got.body as { language: string }).language).toBe("vi");
  });

  it("records events without mapping by default", async () => {
    const upstreamUrl = await startUpstream();
    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl, ner: false, language: "en" },
    });

    await json(`${proxy.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-test",
        messages: [{ role: "user", content: "mail me at john@example.com" }],
      }),
    });

    const events = await json(`${proxy.url}/admin/api/events?limit=5`);
    const event = (events.body as { events: Array<Record<string, unknown>> }).events[0]!;
    expect(event.path).toBe("/v1/chat/completions");
    expect(event.hasMapping).toBe(false);
    expect((event.labels as string[]).length).toBeGreaterThan(0);
    expect((event.entityCounts as Record<string, number>).EMAIL_ADDRESS).toBe(1);

    const mapping = await json(`${proxy.url}/admin/api/events/${event.id as number}/mapping`);
    expect(mapping.status).toBe(404);
  });

  it("stores and clears mappings when recordMappings toggles", async () => {
    const upstreamUrl = await startUpstream();
    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl, ner: false, language: "en", recordMappings: true },
    });

    await json(`${proxy.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-test",
        messages: [{ role: "user", content: "john@example.com" }],
      }),
    });

    const events = await json(`${proxy.url}/admin/api/events?limit=1`);
    const event = (events.body as { events: Array<{ id: number; hasMapping: boolean }> }).events[0]!;
    expect(event.hasMapping).toBe(true);

    const mapping = await json(`${proxy.url}/admin/api/events/${event.id}/mapping`);
    expect(mapping.status).toBe(200);
    expect((mapping.body as { mapping: Record<string, string> }).mapping).toMatchObject({
      "<Email_1>": "john@example.com",
    });

    await json(`${proxy.url}/admin/api/config`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recordMappings: false }),
    });

    const gone = await json(`${proxy.url}/admin/api/events/${event.id}/mapping`);
    expect(gone.status).toBe(404);
  });

  it("preview anonymizes locally without hitting upstream", async () => {
    let hit = false;
    upstream = createServer(() => {
      hit = true;
    });
    await new Promise<void>((resolve) => upstream!.listen(0, "127.0.0.1", resolve));
    const addr = upstream.address();
    const port = typeof addr === "object" && addr !== null ? addr.port : 0;

    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl: `http://127.0.0.1:${port}`, ner: false, language: "en" },
    });

    const preview = await json(`${proxy.url}/admin/api/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Contact john@example.com" }),
    });
    expect(preview.status).toBe(200);
    expect((preview.body as { anonymized: string }).anonymized).toBe("Contact <Email_1>");
    expect(hit).toBe(false);
  });

  it("rejects non-loopback Host on admin routes", async () => {
    const upstreamUrl = await startUpstream();
    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl, ner: false },
      log: () => {},
    });

    const url = new URL(`${proxy.url}/admin/api/status`);
    const statusCode = await new Promise<number>((resolve, reject) => {
      const req = request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          headers: { host: "evil.example" },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on("error", reject);
      req.end();
    });
    expect(statusCode).toBe(403);
  });
});
