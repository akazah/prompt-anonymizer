/**
 * Shared contract between the proxy server and the admin GUI
 * (`web/apps/proxy-admin` keeps a small mirrored copy of these types —
 * the app cannot depend on this package without a workspace cycle).
 *
 * Privacy invariants (P0):
 * - The label -> original mapping lives in memory for the duration of a
 *   request only, unless `recordMappings` is explicitly enabled — and even
 *   then it stays in a capped in-memory ring buffer, never on disk.
 * - Redaction events expose labels and counts by default, never original
 *   values.
 * - The admin API and GUI are only reachable on the loopback interface
 *   unless the operator passes an explicit `--host`.
 */

/** Runtime-mutable proxy configuration (GET/PUT `/admin/api/config`). */
export interface ProxyConfig {
  /** Upstream OpenAI-compatible base URL, e.g. `https://api.openai.com`. */
  upstreamUrl: string;
  /** Use the transformers.js NER model (names & locations). */
  ner: boolean;
  /** Language for detection; `auto` = on-device detection per request. */
  language: "auto" | "en" | "ja";
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
  language: "en" | "ja";
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
  language?: "auto" | "en" | "ja";
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
  language: "en" | "ja";
}

export interface AdminErrorResponse {
  error: string;
}
