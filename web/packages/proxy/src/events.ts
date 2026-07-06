/**
 * In-memory request statistics and redaction event ring buffer.
 *
 * Events expose labels and entity counts by default — never original values.
 * Mappings are retained only when `recordMappings` is enabled, and only
 * inside this capped buffer; nothing is written to disk or logs.
 */

import type { Language } from "@prompt-anonymizer/core";

import type { ProxyConfig, RedactionEvent } from "./api-types.js";

export interface StoredEvent {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  model?: string;
  language: Language;
  stream: boolean;
  entityCounts: Record<string, number>;
  labels: string[];
  durationMs: number;
  status: "ok" | "upstream_error" | "error";
  upstreamStatus?: number;
  mapping?: Record<string, string>;
}

export class ProxyState {
  private nextId = 1;
  private readonly buffer: StoredEvent[] = [];
  private static readonly MAX_EVENTS = 100;

  readonly startTime = Date.now();
  config: ProxyConfig;
  nerReady: boolean;

  readonly requests = {
    total: 0,
    anonymized: 0,
    passthrough: 0,
    errors: 0,
  };

  constructor(config: ProxyConfig, nerReady: boolean) {
    this.config = { ...config };
    this.nerReady = nerReady;
  }

  addEvent(
    event: Omit<StoredEvent, "id">,
    recordMappings: boolean,
  ): number {
    const { mapping, ...rest } = event;
    const id = this.nextId++;
    const stored: StoredEvent = { ...rest, id };
    if (recordMappings && mapping !== undefined) {
      stored.mapping = { ...mapping };
    }
    this.buffer.unshift(stored);
    if (this.buffer.length > ProxyState.MAX_EVENTS) {
      this.buffer.length = ProxyState.MAX_EVENTS;
    }
    this.requests.total++;
    return id;
  }

  /** Snapshot events without the mapping field (sets `hasMapping` instead). */
  snapshotEvents(limit: number): RedactionEvent[] {
    return this.buffer.slice(0, limit).map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      method: event.method,
      path: event.path,
      model: event.model,
      language: event.language,
      stream: event.stream,
      entityCounts: { ...event.entityCounts },
      labels: [...event.labels],
      durationMs: event.durationMs,
      status: event.status,
      upstreamStatus: event.upstreamStatus,
      hasMapping: event.mapping !== undefined,
    }));
  }

  getMapping(id: number): Record<string, string> | null {
    const event = this.buffer.find((e) => e.id === id);
    if (event?.mapping === undefined) return null;
    return { ...event.mapping };
  }

  /** Drop all stored mappings (e.g. when `recordMappings` is turned off). */
  clearMappings(): void {
    for (const event of this.buffer) {
      delete event.mapping;
    }
  }
}
