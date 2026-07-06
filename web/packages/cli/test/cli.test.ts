import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Anonymizer } from "@prompt-anonymizer/core";
import { run, type CliIo, type EngineFactory } from "../src/main.js";

interface Captured {
  io: CliIo;
  stdout: string[];
  stderr: string[];
}

function makeIo(options: { stdin?: string; confirm?: boolean } = {}): Captured {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      out: (text) => stdout.push(text),
      err: (text) => stderr.push(text),
      readStdin: () => Promise.resolve(options.stdin ?? ""),
      confirm: () => Promise.resolve(options.confirm ?? true),
    },
  };
}

/** Real regex-only engine: no model download, deterministic. */
const regexOnly: EngineFactory = () => new Anonymizer();

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "pa-cli-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("anonymize", () => {
  it("masks PII from --text and auto-detects Japanese", async () => {
    const { io, stdout } = makeIo();
    const code = await run(
      ["anonymize", "--no-ner", "-t", "連絡は 090-1234-5678 か taro@example.com まで"],
      io,
      regexOnly,
    );
    expect(code).toBe(0);
    expect(stdout.at(-1)).toBe("連絡は <電話番号_1> か <メールアドレス_1> まで");
  });

  it("reads from stdin and uses English labels with -l en", async () => {
    const { io, stdout } = makeIo({ stdin: "Mail john@example.com please" });
    const code = await run(["anonymize", "--no-ner", "-l", "en"], io, regexOnly);
    expect(code).toBe(0);
    expect(stdout.at(-1)).toBe("Mail <Email_1> please");
  });

  it("uses Spanish labels with -l es", async () => {
    const { io, stdout } = makeIo();
    const code = await run(
      ["anonymize", "--no-ner", "-l", "es", "-t", "Correo maria.garcia@example.com o +34 612 345 678"],
      io,
      regexOnly,
    );
    expect(code).toBe(0);
    expect(stdout.at(-1)).toBe("Correo <Correo_1> o <Teléfono_1>");
  });

  it("uses Vietnamese labels with -l vi", async () => {
    const { io, stdout } = makeIo();
    const code = await run(
      ["anonymize", "--no-ner", "-l", "vi", "-t", "Email an.nguyen@example.com hoặc 0912 345 678"],
      io,
      regexOnly,
    );
    expect(code).toBe(0);
    expect(stdout.at(-1)).toBe("Email <Email_1> hoặc <SốĐiệnThoại_1>");
  });

  it("outputs the Python CLI's --json shape (snake_case entity_type)", async () => {
    const { io, stdout } = makeIo();
    const code = await run(
      ["anonymize", "--no-ner", "--json", "-l", "en", "-t", "john@example.com"],
      io,
      regexOnly,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout.at(-1)!) as {
      text: string;
      mapping: Record<string, string>;
      entities: Array<Record<string, unknown>>;
    };
    expect(parsed.text).toBe("<Email_1>");
    expect(parsed.mapping).toEqual({ "<Email_1>": "john@example.com" });
    expect(parsed.entities[0]).toMatchObject({ start: 0, end: 16, entity_type: "EMAIL_ADDRESS" });
  });

  it("warns on stderr when NER is disabled", async () => {
    const { io, stderr } = makeIo();
    await run(["anonymize", "--no-ner", "-t", "hi", "-l", "en"], io, regexOnly);
    expect(stderr.join("\n")).toContain("names and locations will NOT be masked");
  });

  it("exits 2 when the interactive review is rejected", async () => {
    const { io, stderr } = makeIo({ confirm: false });
    const code = await run(
      ["anonymize", "--no-ner", "-i", "-t", "john@example.com", "-l", "en"],
      io,
      regexOnly,
    );
    expect(code).toBe(2);
    expect(stderr).toContain("aborted");
  });

  it("errors without input", async () => {
    const { io, stderr } = makeIo();
    const code = await run(["anonymize", "--no-ner"], io, regexOnly);
    expect(code).toBe(1);
    expect(stderr.join("\n")).toContain("Provide --text, --file, or pipe text via stdin.");
  });

  it("rejects unsupported languages", async () => {
    const { io, stderr } = makeIo();
    const code = await run(["anonymize", "--no-ner", "-l", "fr", "-t", "x"], io, regexOnly);
    expect(code).toBe(1);
    expect(stderr.join("\n")).toContain("Unsupported language: fr");
  });
});

describe("anonymize -> deanonymize round trip", () => {
  it("restores the original text via --mapping-file", async () => {
    const original = "山田さんの連絡先: 090-1234-5678 / taro@example.com";
    const mappingFile = join(dir, "mapping.json");

    const anon = makeIo();
    expect(
      await run(
        ["anonymize", "--no-ner", "-t", original, "--mapping-file", mappingFile],
        anon.io,
        regexOnly,
      ),
    ).toBe(0);
    const anonymized = anon.stdout.at(-1)!;
    expect(anonymized).not.toContain("090-1234-5678");
    expect(anonymized).not.toContain("taro@example.com");
    expect(JSON.parse(await readFile(mappingFile, "utf-8"))).toMatchObject({
      "<電話番号_1>": "090-1234-5678",
    });

    const dean = makeIo();
    expect(
      await run(["deanonymize", "-t", anonymized, "--mapping-file", mappingFile], dean.io),
    ).toBe(0);
    expect(dean.stdout.at(-1)).toBe(original);
  });

  it("reads the text to restore from a file", async () => {
    const mappingFile = join(dir, "m2.json");
    const textFile = join(dir, "reply.txt");
    await writeFile(mappingFile, JSON.stringify({ "<人名_1>": "山田太郎" }), "utf-8");
    await writeFile(textFile, "<人名_1>様、ご確認ください。", "utf-8");
    const { io, stdout } = makeIo();
    expect(await run(["deanonymize", "-f", textFile, "--mapping-file", mappingFile], io)).toBe(0);
    expect(stdout.at(-1)).toBe("山田太郎様、ご確認ください。");
  });

  it("requires --mapping-file", async () => {
    const { io, stderr } = makeIo();
    expect(await run(["deanonymize", "-t", "x"], io)).toBe(1);
    expect(stderr.join("\n")).toContain("--mapping-file is required.");
  });
});

describe("misc commands", () => {
  it("prints the package version", async () => {
    const { io, stdout } = makeIo();
    expect(await run(["version"], io)).toBe(0);
    expect(stdout.at(-1)).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("prints usage and exits 1 without a command", async () => {
    const { io, stdout } = makeIo();
    expect(await run([], io)).toBe(1);
    expect(stdout.join("\n")).toContain("Usage:");
  });

  it("prints usage and exits 0 for --help", async () => {
    const { io } = makeIo();
    expect(await run(["--help"], io)).toBe(0);
  });

  it("fails on unknown commands", async () => {
    const { io, stderr } = makeIo();
    expect(await run(["frobnicate"], io)).toBe(1);
    expect(stderr.join("\n")).toContain("Unknown command: frobnicate");
  });
});
