/**
 * Distribution-boundary checks for the proxy package: healthz, static admin
 * UI (copied into dist/ui by copy-ui.mjs at build time), and CLI help/version.
 *
 * HTTP anonymize/restore coverage lives in proxy.test.ts / admin.test.ts.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { Anonymizer } from "@prompt-anonymizer/core";
import { runCli, type ProxyIo } from "../src/main.js";
import { startProxyServer, type ProxyServer } from "../src/server.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_INDEX = join(HERE, "../dist/ui/index.html");

const regexEngine = () => new Anonymizer();

let proxy: ProxyServer | undefined;
let upstream: Server | undefined;

afterEach(async () => {
  if (proxy) {
    proxy.server.closeAllConnections();
    await proxy.close();
  }
  if (upstream) {
    await new Promise<void>((resolve, reject) =>
      upstream!.close((e) => (e ? reject(e) : resolve())),
    );
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

function makeIo(): { io: ProxyIo; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      out: (text) => stdout.push(text),
      err: (text) => stderr.push(text),
    },
  };
}

describe("proxy healthz and static admin", () => {
  it("GET /healthz returns ok", async () => {
    const upstreamUrl = await startUpstream();
    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl, ner: false },
    });
    const res = await fetch(`${proxy.url}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("GET /admin/ serves the built admin UI HTML when dist/ui exists", async () => {
    expect(
      existsSync(UI_INDEX),
      "dist/ui/index.html missing — proxy build (copy-ui.mjs) must run first",
    ).toBe(true);

    const upstreamUrl = await startUpstream();
    proxy = await startProxyServer({
      port: 0,
      engineFactory: regexEngine,
      config: { upstreamUrl, ner: false },
    });

    const res = await fetch(`${proxy.url}/admin/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.toLowerCase()).toContain("<!doctype html>");
    expect(html).toMatch(/prompt.?anonymizer/i);
  });
});

describe("proxy runCli smoke", () => {
  it("prints help and exits 0", async () => {
    const { io, stdout } = makeIo();
    expect(await runCli(["--help"], io)).toBe(0);
    expect(stdout.join("\n")).toContain("prompt-anonymizer-proxy");
    expect(stdout.join("\n")).toContain("--upstream");
  });

  it("prints the package version", async () => {
    const { io, stdout } = makeIo();
    expect(await runCli(["--version"], io)).toBe(0);
    expect(stdout.at(-1)).toMatch(/^\d+\.\d+\.\d+/);
  });
});
