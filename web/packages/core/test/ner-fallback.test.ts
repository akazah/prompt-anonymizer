import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransformersNerBackend } from "../src/ner.js";

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
