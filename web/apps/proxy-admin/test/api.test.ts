import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getStatus,
  getConfig,
  putConfig,
  getEvents,
  getEventMapping,
  postPreview,
  type ProxyStatus,
  type ProxyConfig,
  type RedactionEvent,
  type PreviewRequest,
  type PreviewResponse,
} from "../src/api.js";

const mockStatus: ProxyStatus = {
  version: "1.0.0",
  uptimeSeconds: 3600,
  host: "localhost",
  port: 8000,
  config: {
    upstreamUrl: "https://api.openai.com",
    ner: false,
    language: "auto",
    denyList: [],
    allowList: [],
    recordMappings: false,
  },
  nerReady: true,
  requests: {
    total: 10,
    anonymized: 8,
    passthrough: 2,
    errors: 0,
  },
};

const mockConfig: ProxyConfig = {
  upstreamUrl: "https://api.openai.com",
  ner: true,
  language: "en",
  denyList: ["secret"],
  allowList: ["public"],
  recordMappings: true,
};

const mockEvent: RedactionEvent = {
  id: 1,
  timestamp: "2024-01-01T00:00:00Z",
  method: "POST",
  path: "/chat/completions",
  model: "gpt-4",
  language: "en",
  stream: false,
  entityCounts: { PERSON: 2 },
  labels: ["<人名_1>", "<人名_2>"],
  durationMs: 100,
  status: "ok",
  upstreamStatus: 200,
  hasMapping: true,
};

describe("api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStatus", () => {
    it("should return parsed ProxyStatus on success", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockStatus,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await getStatus();

      expect(result).toEqual(mockStatus);
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith("/admin/api/status", undefined);
    });

    it("should throw with error message from JSON body on error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
        json: async () => ({ error: "Database connection failed" }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(getStatus()).rejects.toThrow("Database connection failed");
    });

    it("should throw with statusText when error response body is not JSON", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Service Unavailable",
        json: async () => {
          throw new Error("Not JSON");
        },
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(getStatus()).rejects.toThrow("Service Unavailable");
    });
  });

  describe("getConfig", () => {
    it("should return parsed ProxyConfig", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockConfig,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await getConfig();

      expect(result).toEqual(mockConfig);
      expect(mockFetch).toHaveBeenCalledWith("/admin/api/config", undefined);
    });
  });

  describe("putConfig", () => {
    it("should send PUT request with JSON body", async () => {
      const patch: Partial<ProxyConfig> = { ner: false };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockConfig, ...patch }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await putConfig(patch);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [path, init] = mockFetch.mock.calls[0];
      expect(path).toBe("/admin/api/config");
      expect(init?.method).toBe("PUT");
      expect(init?.headers).toEqual({ "Content-Type": "application/json" });
      expect(init?.body).toBe(JSON.stringify(patch));
    });
  });

  describe("getEvents", () => {
    it("should return events array for limit of 25", async () => {
      const mockEvents = [mockEvent];
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ events: mockEvents }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await getEvents(25);

      expect(result).toEqual(mockEvents);
      expect(mockFetch).toHaveBeenCalledWith(
        "/admin/api/events?limit=25",
        undefined
      );
    });

    it("should use default limit of 50 when not specified", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ events: [] }),
      });
      vi.stubGlobal("fetch", mockFetch);

      await getEvents();

      expect(mockFetch).toHaveBeenCalledWith(
        "/admin/api/events?limit=50",
        undefined
      );
    });
  });

  describe("getEventMapping", () => {
    it("should return event mapping response", async () => {
      const mapping = { "<人名_1>": "John Doe" };
      const response = { id: 1, mapping };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => response,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await getEventMapping(1);

      expect(result).toEqual(response);
      expect(mockFetch).toHaveBeenCalledWith(
        "/admin/api/events/1/mapping",
        undefined
      );
    });
  });

  describe("postPreview", () => {
    it("should send POST request with preview request body", async () => {
      const request: PreviewRequest = {
        text: "John Doe email is john@example.com",
        language: "en",
      };
      const response: PreviewResponse = {
        text: request.text,
        anonymized: "<人名_1> email is <Email_1>",
        mapping: { "<人名_1>": "John Doe", "<Email_1>": "john@example.com" },
        entities: [
          { start: 0, end: 8, entity_type: "PERSON", score: 0.99 },
        ],
        language: "en",
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => response,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await postPreview(request);

      expect(result).toEqual(response);
      expect(mockFetch).toHaveBeenCalledOnce();
      const [path, init] = mockFetch.mock.calls[0];
      expect(path).toBe("/admin/api/preview");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "Content-Type": "application/json" });
      expect(init?.body).toBe(JSON.stringify(request));
    });
  });
});
