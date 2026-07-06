/**
 * Mirrored from `web/packages/proxy/src/api-types.ts` — keep in sync manually
 * (the app cannot depend on `@prompt-anonymizer/proxy` without a workspace cycle).
 */

/**
 * Local mirror of the core language registry (`LANGUAGES` in
 * `web/packages/core/src/types.ts`) — this app does not depend on
 * `@prompt-anonymizer/core`, so keep this list in sync when adding a
 * language there. Everything below derives from this single list.
 */
export const LANGUAGES = ["en", "ja", "es", "vi", "zh", "ko", "fr", "de", "pt", "it"] as const;

export type Language = (typeof LANGUAGES)[number];

/** Runtime guard for language strings (mirrors core's `isLanguage`). */
export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/** Native display names (mirrors core's `LANGUAGE_NAMES`). */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  ja: "日本語",
  es: "Español",
  vi: "Tiếng Việt",
  zh: "中文",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  it: "Italiano",
};

/** Runtime-mutable proxy configuration (GET/PUT `/admin/api/config`). */
export interface ProxyConfig {
  /** Upstream OpenAI-compatible base URL, e.g. `https://api.openai.com`. */
  upstreamUrl: string;
  /** Use the transformers.js NER model (names & locations). */
  ner: boolean;
  /** Language for detection; `auto` = on-device detection per request. */
  language: "auto" | Language;
  /** Strings to always mask (labelled CUSTOM / 秘匿情報). */
  denyList: string[];
  /** Strings to never mask even when detected. */
  allowList: string[];
  /**
   * Keep each request's label -> original mapping in the in-memory event
   * ring buffer so the GUI can reveal originals on demand. Off by default:
   * enabling this keeps PII in proxy memory beyond the request lifetime.
   */
  recordMappings: boolean;
}

/** GET `/admin/api/status`. */
export interface ProxyStatus {
  version: string;
  uptimeSeconds: number;
  /** Host/port the proxy is listening on. */
  host: string;
  port: number;
  config: ProxyConfig;
  /** Whether the NER model finished loading (false = first request will download it). */
  nerReady: boolean;
  requests: {
    total: number;
    anonymized: number;
    passthrough: number;
    errors: number;
  };
}

/** One proxied chat-completions request (GET `/admin/api/events`). */
export interface RedactionEvent {
  id: number;
  /** ISO 8601. */
  timestamp: string;
  method: string;
  path: string;
  /** `model` from the request body, when present. */
  model?: string;
  language: Language;
  stream: boolean;
  /** entityType -> number of masked occurrences, e.g. `{ PERSON: 2 }`. */
  entityCounts: Record<string, number>;
  /** Labels assigned in this request, e.g. `["<人名_1>", "<Email_1>"]`. */
  labels: string[];
  durationMs: number;
  status: "ok" | "upstream_error" | "error";
  /** HTTP status returned by the upstream, when it responded. */
  upstreamStatus?: number;
  /** True when the mapping can be revealed via `/admin/api/events/:id/mapping`. */
  hasMapping: boolean;
}

export interface EventsResponse {
  events: RedactionEvent[];
}

/**
 * GET `/admin/api/events/:id/mapping` — 404 unless the event was recorded
 * with `recordMappings` enabled. Explicit reveal only; the GUI must never
 * fetch this automatically.
 */
export interface EventMappingResponse {
  id: number;
  mapping: Record<string, string>;
}

/** POST `/admin/api/preview` request body. */
export interface PreviewRequest {
  text: string;
  /** Defaults to `auto`. */
  language?: "auto" | Language;
}

/**
 * POST `/admin/api/preview` — local-only anonymization playground.
 * Nothing is forwarded upstream; the mapping is returned to the caller
 * (the localhost GUI) and not retained by the proxy.
 */
export interface PreviewResponse {
  text: string;
  anonymized: string;
  mapping: Record<string, string>;
  entities: Array<{ start: number; end: number; entity_type: string; score: number }>;
  language: Language;
}

export interface AdminErrorResponse {
  error: string;
}

const API_BASE = "/admin/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as AdminErrorResponse;
      if (typeof body.error === "string") message = body.error;
    } catch {
      /* ignore non-JSON body */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function getStatus(): Promise<ProxyStatus> {
  return request<ProxyStatus>("/status");
}

export async function getConfig(): Promise<ProxyConfig> {
  return request<ProxyConfig>("/config");
}

export async function putConfig(patch: Partial<ProxyConfig>): Promise<ProxyConfig> {
  return request<ProxyConfig>("/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function getEvents(limit = 50): Promise<RedactionEvent[]> {
  const data = await request<EventsResponse>(`/events?limit=${limit}`);
  return data.events;
}

export async function getEventMapping(id: number): Promise<EventMappingResponse> {
  return request<EventMappingResponse>(`/events/${id}/mapping`);
}

export async function postPreview(req: PreviewRequest): Promise<PreviewResponse> {
  return request<PreviewResponse>("/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}
