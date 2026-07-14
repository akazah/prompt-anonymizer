/**
 * Distribution-boundary checks for the proxy package: healthz, static admin
 * UI (served from dist/ui next to the built module), and CLI help/version.
 *
 * HTTP anonymize/restore coverage lives in proxy.test.ts / admin.test.ts.
 * The admin HTML path is exercised via spawned dist/cli.js because
 * `UI_DIR` resolves relative to the loaded module (`dist/ui`, not `src/ui`).
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { Anonymizer } from "@prompt-anonymizer/core";
import { runCli, type ProxyIo } from "../src/main.js";
import { startProxyServer, type ProxyServer } from "../src/server.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROXY_CLI = join(HERE, "../dist/cli.js");
const UI_INDEX = join(HERE, "../dist/ui/index.html");

const regexEngine = () => new Anonymizer();

let proxy: ProxyServer | undefined;
let upstream: Server | undefined;
let child: ChildProcess | undefined;

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
  if (child && !child.killed) {
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      child!.once("exit", () => resolve());
      setTimeout(() => {
        child?.kill("SIGKILL");
        resolve();
      }, 2000);
    });
  }
  proxy = undefined;
  upstream = undefined;
  child = undefined;
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

function startProxyBin(upstreamUrl: string): Promise<{ process: ChildProcess; url: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      [PROXY_CLI, "-p", "0", "--no-ner", "-u", upstreamUrl],
      { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NO_COLOR: "1" } },
    );
    let stderr = "";
    const onData = (chunk: Buffer): void => {
      stderr += chunk.toString("utf-8");
      const match = stderr.match(/OpenAI-compatible endpoint: (http:\/\/127\.0\.0\.1:\d+)\/v1/);
      if (match) {
        proc.stderr?.off("data", onData);
        resolve({ process: proc, url: match[1]! });
      }
    };
    proc.stderr?.on("data", onData);
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`proxy exited early (${code}): ${stderr}`));
      }
    });
    setTimeout(() => reject(new Error(`proxy did not become ready:\n${stderr}`)), 15_000);
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

describe("proxy healthz", () => {
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
});

describe("proxy static admin (dist/cli.js)", () => {
  it("GET /admin/ serves the built admin UI HTML", async () => {
    expect(existsSync(PROXY_CLI), "dist/cli.js missing — build proxy first").toBe(true);
    expect(
      existsSync(UI_INDEX),
      "dist/ui/index.html missing — proxy build (copy-ui.mjs) must run first",
    ).toBe(true);

    const upstreamUrl = await startUpstream();
    const started = await startProxyBin(upstreamUrl);
    child = started.process;

    const res = await fetch(`${started.url}/admin/`);
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
