import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Anonymizer } from "@prompt-anonymizer/core";
import { createServer, type EngineFactory } from "../src/server.js";

/** Real regex-only engine: no model download, deterministic. */
const regexOnly: EngineFactory = ({ entities, denyList, allowList }) =>
  new Anonymizer({ ...(entities !== undefined ? { entities } : {}), denyList, allowList });

interface TextContent {
  type: string;
  text: string;
}

async function connect(options: Parameters<typeof createServer>[0] = {}) {
  const server = createServer({ engineFactory: regexOnly, ...options });
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

function firstText(result: { content?: unknown }): string {
  const content = result.content as TextContent[];
  expect(content.length).toBeGreaterThan(0);
  return content[0]!.text;
}

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "pa-mcp-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("tool listing", () => {
  it("exposes anonymize, deanonymize and scan", async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["anonymize", "deanonymize", "scan"]);
  });
});

describe("anonymize", () => {
  it("masks PII, auto-detects Japanese, and withholds the mapping by default", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "anonymize",
      arguments: { text: "連絡は 090-1234-5678 か taro@example.com まで" },
    });
    const payload = JSON.parse(firstText(result)) as Record<string, unknown>;
    expect(payload.text).toBe("連絡は <電話番号_1> か <メールアドレス_1> まで");
    expect(typeof payload.mapping_id).toBe("string");
    expect(payload.mapping).toBeUndefined();
    expect(payload.entity_counts).toEqual({ PHONE_NUMBER: 1, EMAIL_ADDRESS: 1 });
  });

  it("accepts a language added by the registry (zh) and uses its labels", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "anonymize",
      arguments: { text: "请发送到 test@example.com", language: "zh" },
    });
    const payload = JSON.parse(firstText(result)) as Record<string, unknown>;
    expect(payload.text).toBe("请发送到 <电子邮箱_1>");
    expect(payload.entity_counts).toEqual({ EMAIL_ADDRESS: 1 });
  });

  it("rejects an unsupported language code", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "anonymize",
      arguments: { text: "hello", language: "xx" },
    });
    expect(result.isError).toBe(true);
  });

  it("returns the mapping only when return_mapping is true", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "anonymize",
      arguments: { text: "Mail john@example.com", language: "en", return_mapping: true },
    });
    const payload = JSON.parse(firstText(result)) as Record<string, unknown>;
    expect(payload.mapping).toEqual({ "<Email_1>": "john@example.com" });
  });

  it("anonymizes a file so the original text never enters the context", async () => {
    const file = join(dir, "input.txt");
    await writeFile(file, "Call 090-1234-5678 now", "utf-8");
    const { client } = await connect();
    const result = await client.callTool({
      name: "anonymize",
      arguments: { file, language: "en" },
    });
    const payload = JSON.parse(firstText(result)) as Record<string, unknown>;
    expect(payload.text).toBe("Call <Phone_1> now");
  });

  it("applies deny and allow lists", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "anonymize",
      arguments: {
        text: "ProjectX contact: kept@example.com",
        language: "en",
        deny_list: ["ProjectX"],
        allow_list: ["kept@example.com"],
      },
    });
    const payload = JSON.parse(firstText(result)) as Record<string, unknown>;
    expect(payload.text).toBe("<Custom_1> contact: kept@example.com");
  });

  it("passes split_person_names through to the engine factory", async () => {
    const received: Array<boolean | undefined> = [];
    const factory: EngineFactory = ({ splitPersonNames }) => {
      received.push(splitPersonNames);
      return new Anonymizer({ splitPersonNames });
    };
    const { client } = await connect({ engineFactory: factory });
    await client.callTool({
      name: "anonymize",
      arguments: { text: "hello", language: "en", split_person_names: true },
    });
    await client.callTool({
      name: "anonymize",
      arguments: { text: "hello", language: "en" },
    });
    expect(received).toEqual([true, false]);
  });

  it("rejects calls with both text and file", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "anonymize",
      arguments: { text: "x", file: "/nonexistent" },
    });
    expect(result.isError).toBe(true);
  });
});

describe("deanonymize", () => {
  it("round-trips via mapping_id without exposing the mapping", async () => {
    const { client } = await connect();
    const original = "連絡は 090-1234-5678 か taro@example.com まで";
    const anonymized = JSON.parse(
      firstText(await client.callTool({ name: "anonymize", arguments: { text: original } })),
    ) as { text: string; mapping_id: string };

    const restored = await client.callTool({
      name: "deanonymize",
      arguments: { text: anonymized.text, mapping_id: anonymized.mapping_id },
    });
    expect(firstText(restored)).toBe(original);
  });

  it("accepts an explicit mapping", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "deanonymize",
      arguments: { text: "Dear <Name_1>", mapping: { "<Name_1>": "John Smith" } },
    });
    expect(firstText(result)).toBe("Dear John Smith");
  });

  it("writes to output_file instead of returning the restored text", async () => {
    const { client } = await connect();
    const out = join(dir, "restored.txt");
    const result = await client.callTool({
      name: "deanonymize",
      arguments: {
        text: "Dear <Name_1>",
        mapping: { "<Name_1>": "John Smith" },
        output_file: out,
      },
    });
    const payload = JSON.parse(firstText(result)) as Record<string, unknown>;
    expect(payload.written).toBe(out);
    expect(firstText(result)).not.toContain("John Smith");
    expect(await readFile(out, "utf-8")).toBe("Dear John Smith");
  });

  it("errors on an unknown mapping_id", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "deanonymize",
      arguments: { text: "<Name_1>", mapping_id: "not-a-real-id" },
    });
    expect(result.isError).toBe(true);
  });
});

describe("scan", () => {
  it("reports findings with locations but never the matched text", async () => {
    const file = join(dir, "leak.txt");
    await writeFile(file, "line one\ncall 090-1234-5678\n", "utf-8");
    const { client } = await connect();
    const result = await client.callTool({ name: "scan", arguments: { files: [file] } });
    const payload = JSON.parse(firstText(result)) as {
      clean: boolean;
      findings: Array<Record<string, unknown>>;
    };
    expect(payload.clean).toBe(false);
    expect(payload.findings).toHaveLength(1);
    expect(payload.findings[0]).toMatchObject({
      file,
      line: 2,
      entity_type: "PHONE_NUMBER",
    });
    expect(firstText(result)).not.toContain("090-1234-5678");
  });

  it("reports clean text as clean", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "scan",
      arguments: { text: "nothing sensitive here", language: "en" },
    });
    const payload = JSON.parse(firstText(result)) as { clean: boolean };
    expect(payload.clean).toBe(true);
  });

  it("flags deny-list terms", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "scan",
      arguments: { text: "mentions ProjectX", language: "en", deny_list: ["ProjectX"] },
    });
    const payload = JSON.parse(firstText(result)) as {
      clean: boolean;
      findings: Array<{ entity_type: string }>;
    };
    expect(payload.clean).toBe(false);
    expect(payload.findings[0]!.entity_type).toBe("CUSTOM");
  });

  it("errors when a file cannot be read", async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: "scan",
      arguments: { files: [join(dir, "missing.txt")] },
    });
    expect(result.isError).toBe(true);
  });
});
