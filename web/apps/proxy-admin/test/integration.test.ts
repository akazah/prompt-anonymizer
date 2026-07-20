// @vitest-environment jsdom
/**
 * Live integration: proxy-admin UI against a real localhost proxy process
 * (spawned `dist/cli.js`, regex-only / --no-ner). Relative `/admin/api/*`
 * fetches are rewritten to the ephemeral proxy URL so jsdom can talk to
 * the Node HTTP server without importing proxy sources into the jsdom realm.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROXY_CLI = join(HERE, "../../../packages/proxy/dist/cli.js");

let proxy: ChildProcess;
let proxyUrl: string;
let upstream: Server;
let realFetch: typeof fetch;

async function startUpstream(): Promise<string> {
  return new Promise((resolve) => {
    upstream = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          choices: [{ message: { content: "確認しました" } }],
        }),
      );
    });
    upstream.listen(0, "127.0.0.1", () => {
      const addr = upstream.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

function startProxy(upstreamUrl: string): Promise<{ child: ChildProcess; url: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [PROXY_CLI, "-p", "0", "--no-ner", "-u", upstreamUrl, "-l", "ja"],
      { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NO_COLOR: "1" } },
    );
    let stderr = "";
    const onData = (chunk: Buffer): void => {
      stderr += chunk.toString("utf-8");
      const match = stderr.match(/OpenAI-compatible endpoint: (http:\/\/127\.0\.0\.1:\d+)\/v1/);
      if (match) {
        child.stderr?.off("data", onData);
        resolve({ child, url: match[1]! });
      }
    };
    child.stderr?.on("data", onData);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== null && code !== 0) {
        reject(new Error(`proxy exited early (${code}): ${stderr}`));
      }
    });
    setTimeout(() => {
      reject(new Error(`proxy did not become ready:\n${stderr}`));
    }, 15_000);
  });
}

beforeAll(async () => {
  expect(existsSync(PROXY_CLI), "proxy dist/cli.js missing — build packages first").toBe(true);

  const upstreamUrl = await startUpstream();
  const started = await startProxy(upstreamUrl);
  proxy = started.child;
  proxyUrl = started.url;

  realFetch = globalThis.fetch.bind(globalThis);
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    let url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.startsWith("/")) {
      url = `${proxyUrl}${url}`;
    }
    return realFetch(url, init);
  });

  document.body.innerHTML = '<div id="app"></div>';
  await import("../src/main.ts");
});

afterAll(async () => {
  vi.unstubAllGlobals();
  if (proxy && !proxy.killed) {
    proxy.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      proxy.once("exit", () => resolve());
      setTimeout(() => {
        proxy.kill("SIGKILL");
        resolve();
      }, 2000);
    });
  }
  await new Promise<void>((resolve, reject) =>
    upstream.close((e) => (e ? reject(e) : resolve())),
  );
});

describe("proxy-admin live integration", () => {
  it("renders status from the live /admin/api/status", async () => {
    const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

    // Wait for status cards, not just the online badge — loadInitialConfig can
    // finish first and must not mark the proxy online before /admin/api/status
    // has populated Listen/Upstream.
    await vi.waitFor(() => {
      expect($("#proxy-badge").classList.contains("ok")).toBe(true);
      expect($("#stat-listen").textContent).toMatch(/127\.0\.0\.1:\d+/);
    });

    expect($("#proxy-status-text").textContent).toContain("proxy: online");
    expect($("#stat-upstream").textContent).toContain("127.0.0.1");
    expect($("#version-badge").textContent).toMatch(/v\d+\.\d+\.\d+/);
  });

  it("shows an event after a proxied chat completion", async () => {
    const email = "secret@example.com";
    const res = await realFetch(`${proxyUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-key",
      },
      body: JSON.stringify({
        model: "gpt-test",
        messages: [{ role: "user", content: `連絡は ${email}` }],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    // Upstream echoed a label-free reply; client still gets it restored as-is.
    expect(body.choices[0]!.message.content).toBe("確認しました");

    const refresh = document.querySelector<HTMLButtonElement>("#refresh-events")!;
    refresh.click();

    await vi.waitFor(() => {
      const rows = document.querySelectorAll(".event-row");
      expect(rows.length).toBeGreaterThan(0);
    });

    const rowText = document.querySelector(".event-row")!.textContent ?? "";
    expect(rowText).toContain("/v1/chat/completions");
    expect(rowText).toContain("gpt-test");
    // Labels from the anonymized request appear as chips — never the raw email.
    expect(rowText).toMatch(/<メールアドレス_\d+>/);
    expect(rowText).not.toContain(email);
  });
});
