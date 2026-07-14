// @vitest-environment jsdom
/**
 * Live integration: proxy-admin UI against a real localhost proxy server
 * (regex-only engine). Relative `/admin/api/*` fetches are rewritten to the
 * ephemeral proxy URL so jsdom can talk to the Node HTTP server.
 */

import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Anonymizer } from "@prompt-anonymizer/core";
import {
  startProxyServer,
  type ProxyServer,
} from "../../../packages/proxy/src/server.js";

const regexEngine = () => new Anonymizer();

let proxy: ProxyServer;
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

beforeAll(async () => {
  const upstreamUrl = await startUpstream();
  proxy = await startProxyServer({
    port: 0,
    engineFactory: regexEngine,
    config: { upstreamUrl, ner: false, language: "ja" },
    version: "0.0.0-integration",
  });

  realFetch = globalThis.fetch.bind(globalThis);
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    let url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.startsWith("/")) {
      url = `${proxy.url}${url}`;
    }
    return realFetch(url, init);
  });

  document.body.innerHTML = '<div id="app"></div>';
  await import("../src/main.ts");
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await proxy.close();
  await new Promise<void>((resolve, reject) =>
    upstream.close((e) => (e ? reject(e) : resolve())),
  );
});

describe("proxy-admin live integration", () => {
  it("renders status from the live /admin/api/status", async () => {
    const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

    await vi.waitFor(() => {
      expect($("#version-badge").textContent).toContain("0.0.0-integration");
    });

    expect($("#proxy-badge").classList.contains("ok")).toBe(true);
    expect($("#proxy-status-text").textContent).toContain("proxy: online");
    expect($("#stat-listen").textContent).toMatch(/127\.0\.0\.1:\d+/);
    expect($("#stat-upstream").textContent).toContain("127.0.0.1");
  });

  it("shows an event after a proxied chat completion", async () => {
    const email = "secret@example.com";
    const res = await realFetch(`${proxy.url}/v1/chat/completions`, {
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
