// @vitest-environment jsdom
/**
 * jsdom smoke test for the proxy admin UI: status/config/events fetching
 * and basic DOM rendering. This is offline only — globalThis.fetch is
 * stubbed to return canned JSON fixtures matching the TypeScript types
 * from api.ts.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
  ProxyStatus,
  ProxyConfig,
  RedactionEvent,
  EventsResponse,
} from "../src/api";

// Fixture data matching ProxyStatus type
const FIXTURE_STATUS: ProxyStatus = {
  version: "0.2.0",
  uptimeSeconds: 1234,
  host: "127.0.0.1",
  port: 8080,
  config: {
    upstreamUrl: "https://api.openai.com",
    ner: true,
    language: "ja",
    denyList: [],
    allowList: [],
    recordMappings: false,
  },
  nerReady: true,
  requests: {
    total: 42,
    anonymized: 38,
    passthrough: 3,
    errors: 1,
  },
};

// Fixture data matching ProxyConfig type
const FIXTURE_CONFIG: ProxyConfig = {
  upstreamUrl: "https://api.openai.com",
  ner: true,
  language: "ja",
  denyList: ["secret1"],
  allowList: ["preserve-this"],
  recordMappings: false,
};

// Fixture data matching RedactionEvent[] type
const FIXTURE_EVENTS: RedactionEvent[] = [
  {
    id: 1,
    timestamp: new Date().toISOString(),
    method: "POST",
    path: "/v1/chat/completions",
    model: "gpt-4",
    language: "ja",
    stream: false,
    entityCounts: {
      PERSON: 2,
      EMAIL: 1,
    },
    labels: ["<人名_1>", "<人名_2>", "<メールアドレス_1>"],
    durationMs: 450,
    status: "ok",
    hasMapping: true,
  },
];

beforeAll(async () => {
  // Stub globalThis.fetch to return canned responses
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url, "http://localhost").pathname + new URL(url, "http://localhost").search;

      // Mock /admin/api/status
      if (path === "/admin/api/status") {
        return {
          ok: true,
          json: async () => FIXTURE_STATUS,
        } as Response;
      }

      // Mock /admin/api/config
      if (path === "/admin/api/config" && init?.method !== "PUT") {
        return {
          ok: true,
          json: async () => FIXTURE_CONFIG,
        } as Response;
      }

      // Mock PUT /admin/api/config (save)
      if (path === "/admin/api/config" && init?.method === "PUT") {
        return {
          ok: true,
          json: async () => ({ ...FIXTURE_CONFIG, ner: false }), // Simulated update
        } as Response;
      }

      // Mock /admin/api/events
      if (path.startsWith("/admin/api/events")) {
        if (path.includes("/mapping")) {
          // /admin/api/events/:id/mapping
          return {
            ok: true,
            json: async () => ({
              id: 1,
              mapping: {
                "<人名_1>": "山田太郎",
                "<人名_2>": "佐藤花子",
                "<メールアドレス_1>": "taro.yamada@example.com",
              },
            }),
          } as Response;
        }
        // /admin/api/events
        return {
          ok: true,
          json: async () => ({ events: FIXTURE_EVENTS } as EventsResponse),
        } as Response;
      }

      // Default: 404
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: "Not Found" }),
      } as Response;
    })
  );

  // Create root element
  document.body.innerHTML = '<div id="app"></div>';

  // Dynamically import main.ts (which runs startup at module level)
  await import("../src/main.ts");
});

describe("proxy admin UI (jsdom, fetch stubbed)", () => {
  it("renders status from /admin/api/status", async () => {
    const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

    // Wait for status elements to be populated
    await vi.waitFor(() => {
      const versionBadge = $("#version-badge");
      expect(versionBadge.textContent).toContain("0.2.0");
    });

    // Check version is rendered
    expect($("#version-badge").textContent).toContain("0.2.0");

    // Check status card values are rendered
    expect($("#stat-upstream").textContent).toContain("https://api.openai.com");
    expect($("#stat-listen").textContent).toContain("127.0.0.1:8080");
    expect($("#stat-requests").textContent).toContain("42");
    expect($("#stat-requests").textContent).toContain("38");

    // Check proxy badge shows online
    expect($("#proxy-badge").classList.contains("ok")).toBe(true);
    expect($("#proxy-status-text").textContent).toContain("proxy: online");
  });

  it("renders events from /admin/api/events", async () => {
    const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

    // Wait for events to be rendered
    await vi.waitFor(() => {
      const eventRows = document.querySelectorAll(".event-row");
      expect(eventRows.length).toBeGreaterThan(0);
    });

    const eventRows = document.querySelectorAll(".event-row");
    expect(eventRows.length).toBe(1);

    const firstRow = eventRows[0] as HTMLElement;
    const rowText = firstRow.textContent ?? "";

    // Check key event values are rendered in the row
    expect(rowText).toContain("/v1/chat/completions");
    expect(rowText).toContain("gpt-4");
    expect(rowText).toContain("ja");
    expect(rowText).toContain("450");
    expect(rowText).toContain("ok");

    // Check labels are displayed as chips
    const chips = firstRow.querySelectorAll(".chip");
    expect(chips.length).toBe(3); // 3 labels in fixture
    expect(chips[0].textContent).toContain("<人名_1>");
  });
});
