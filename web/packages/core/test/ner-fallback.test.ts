import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransformersNerBackend, detectWebGpu } from "../src/ner.js";

vi.mock("@huggingface/transformers", () => ({ pipeline: vi.fn() }));

const { pipeline } = await import("@huggingface/transformers");
const pipelineMock = vi.mocked(pipeline);

/** A working pipe that tags "John" as a person. */
const workingPipe = async () => [{ entity: "B-PER", score: 0.99, index: 1, word: "John" }];

function deviceOf(call: unknown[]): string {
  return (call[2] as { device: string }).device;
}

beforeEach(() => {
  // Make detectWebGpu() report an available adapter.
  vi.stubGlobal("navigator", { gpu: { requestAdapter: async () => ({}) } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  pipelineMock.mockReset();
});

describe("TransformersNerBackend WebGPU fallback", () => {
  it("falls back to wasm when webgpu init fails under device auto", async () => {
    pipelineMock.mockImplementation(async (_task, _model, options) => {
      if ((options as { device: string }).device === "webgpu") {
        throw new Error("no available backend found. ERR: [webgpu] webgpuInit is not a function");
      }
      return workingPipe as never;
    });

    const backend = new TransformersNerBackend();
    const spans = await backend.detect("John met a friend", "en");

    expect(spans).toEqual([{ start: 0, end: 4, entityType: "PERSON", score: 0.99 }]);
    expect(backend.device).toBe("wasm");
    expect(pipelineMock.mock.calls.map(deviceOf)).toEqual(["webgpu", "wasm"]);
  });

  it("propagates the error when webgpu was explicitly requested", async () => {
    pipelineMock.mockRejectedValue(new Error("no available backend found"));

    const backend = new TransformersNerBackend({ device: "webgpu" });
    await expect(backend.detect("John met a friend", "en")).rejects.toThrow(
      "no available backend found",
    );
    expect(backend.device).toBeNull();
    expect(pipelineMock.mock.calls.map(deviceOf)).toEqual(["webgpu"]);
  });

  it("evicts a failed load so a later detect() retries", async () => {
    pipelineMock
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValue(workingPipe as never);

    const backend = new TransformersNerBackend({ device: "wasm" });
    await expect(backend.detect("John met a friend", "en")).rejects.toThrow("network error");

    const spans = await backend.detect("John met a friend", "en");
    expect(spans).toHaveLength(1);
    expect(backend.device).toBe("wasm");
    expect(pipelineMock.mock.calls.map(deviceOf)).toEqual(["wasm", "wasm"]);
  });

  // Safari/WebKit must never attempt WebGPU: transformers.js <= 4.2 loads the
  // non-JSEP ORT WASM build there (no webgpuInit), and the resulting failure
  // poisons its internal init chain so the in-page WASM retry rethrows the
  // same "no available backend found" error (seen on iOS Safari 26).
  it("goes straight to wasm on Safari even when a WebGPU adapter exists", async () => {
    vi.stubGlobal("navigator", {
      gpu: { requestAdapter: async () => ({}) },
      vendor: "Apple Computer, Inc.",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
    });
    pipelineMock.mockResolvedValue(workingPipe as never);

    const backend = new TransformersNerBackend();
    await backend.detect("John met a friend", "en");

    expect(backend.device).toBe("wasm");
    expect(pipelineMock.mock.calls.map(deviceOf)).toEqual(["wasm"]);
  });

  it("still uses webgpu on Chromium-like browsers with an adapter", async () => {
    vi.stubGlobal("navigator", {
      gpu: { requestAdapter: async () => ({}) },
      vendor: "Google Inc.",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    });
    pipelineMock.mockResolvedValue(workingPipe as never);

    const backend = new TransformersNerBackend();
    await backend.detect("John met a friend", "en");

    expect(backend.device).toBe("webgpu");
    expect(pipelineMock.mock.calls.map(deviceOf)).toEqual(["webgpu"]);
  });

  it("detectWebGpu reports false on Safari despite navigator.gpu", async () => {
    vi.stubGlobal("navigator", {
      gpu: { requestAdapter: async () => ({}) },
      vendor: "Apple Computer, Inc.",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
    });
    expect(await detectWebGpu()).toBe(false);
  });

  it("detectWebGpu is not fooled by Chrome on iOS (CriOS keeps Apple vendor)", async () => {
    vi.stubGlobal("navigator", {
      gpu: { requestAdapter: async () => ({}) },
      vendor: "Apple Computer, Inc.",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.0.0 Mobile/15E148 Safari/604.1",
    });
    // transformers.js treats CriOS as non-Safari and serves it the
    // webgpu-capable WASM build, so we must not force wasm here.
    expect(await detectWebGpu()).toBe(true);
  });

  it("skips webgpu for later languages after one init failure", async () => {
    pipelineMock.mockImplementation(async (_task, _model, options) => {
      if ((options as { device: string }).device === "webgpu") {
        throw new Error("no available backend found");
      }
      return workingPipe as never;
    });

    const backend = new TransformersNerBackend();
    await backend.warmup("en");
    await backend.warmup("ja");

    expect(pipelineMock.mock.calls.map(deviceOf)).toEqual(["webgpu", "wasm", "wasm"]);
  });
});
