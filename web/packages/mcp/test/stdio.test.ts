/**
 * Process-boundary e2e for the published MCP bin (`dist/cli.js`) over
 * StdioClientTransport. Complements the in-memory server.test.ts suite.
 *
 * Offline: the bin defaults to NER off (no model download).
 */

import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, "../dist/cli.js");

interface TextContent {
  type: string;
  text: string;
}

function firstText(result: { content?: unknown }): string {
  const content = result.content as TextContent[];
  expect(content.length).toBeGreaterThan(0);
  return content[0]!.text;
}

async function connectStdio(): Promise<{ client: Client; transport: StdioClientTransport }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [CLI],
    stderr: "pipe",
  });
  const client = new Client({ name: "stdio-e2e", version: "0.0.0" });
  await client.connect(transport);
  return { client, transport };
}

let dir: string;

beforeAll(async () => {
  expect(existsSync(CLI), "dist/cli.js missing — build @prompt-anonymizer/mcp first").toBe(true);
  dir = await mkdtemp(join(tmpdir(), "pa-mcp-stdio-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("dist/cli.js stdio MCP", () => {
  it("lists anonymize, deanonymize and scan tools", async () => {
    const { client, transport } = await connectStdio();
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual(["anonymize", "deanonymize", "scan"]);
    } finally {
      await client.close();
      await transport.close();
    }
  });

  it("round-trips anonymize → deanonymize via mapping_id without exposing mapping", async () => {
    const { client, transport } = await connectStdio();
    try {
      const original = "連絡は 090-1234-5678 か taro@example.com まで";
      const anonymized = JSON.parse(
        firstText(
          await client.callTool({
            name: "anonymize",
            arguments: { text: original },
          }),
        ),
      ) as { text: string; mapping_id: string; mapping?: unknown };

      expect(anonymized.text).toBe("連絡は <電話番号_1> か <メールアドレス_1> まで");
      expect(typeof anonymized.mapping_id).toBe("string");
      expect(anonymized.mapping).toBeUndefined();

      const restored = await client.callTool({
        name: "deanonymize",
        arguments: { text: anonymized.text, mapping_id: anonymized.mapping_id },
      });
      expect(firstText(restored)).toBe(original);
    } finally {
      await client.close();
      await transport.close();
    }
  });

  it("scan reports locations but never the matched text (P0)", async () => {
    const file = join(dir, "leak.txt");
    const phone = "090-1234-5678";
    await writeFile(file, `line one\ncall ${phone}\n`, "utf-8");
    const { client, transport } = await connectStdio();
    try {
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
      expect(firstText(result)).not.toContain(phone);
    } finally {
      await client.close();
      await transport.close();
    }
  });
});
