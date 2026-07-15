/**
 * Process-boundary smoke tests for the published Node CLI bin
 * (`dist/cli.js`). Exercises the real entrypoint over spawn — not the
 * injectable `run()` used by cli.test.ts.
 *
 * Requires `dist/cli.js` (produced by `pnpm --filter ./packages/* build`
 * before `pnpm test`). Offline: scan is model-free; anonymize uses --no-ner.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, "../dist/cli.js");

interface SpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCli(
  args: string[],
  options: { stdin?: string; cwd?: string } = {},
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (c: Buffer) => stdout.push(c));
    child.stderr.on("data", (c: Buffer) => stderr.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf-8"),
        stderr: Buffer.concat(stderr).toString("utf-8"),
      });
    });
    if (options.stdin !== undefined) {
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }
  });
}

let dir: string;

beforeAll(async () => {
  expect(existsSync(CLI), "dist/cli.js missing — build @prompt-anonymizer/cli first").toBe(
    true,
  );
  dir = await mkdtemp(join(tmpdir(), "pa-cli-bin-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("dist/cli.js scan (bin smoke)", () => {
  it("exits 0 on a clean file", async () => {
    const clean = join(dir, "clean.txt");
    await writeFile(clean, "nothing sensitive here\n", "utf-8");
    const result = await runCli(["scan", clean]);
    expect(result.code).toBe(0);
    // Clean summary is written to stderr (findings stay on stdout when present).
    expect(result.stderr).toContain("No PII found");
  });

  it("exits 1 on PII and never prints the matched text (P0)", async () => {
    const dirty = join(dir, "dirty.txt");
    const phone = "090-1234-5678";
    const email = "john@example.com";
    await writeFile(dirty, `line one\ncall ${phone} or ${email}\n`, "utf-8");
    const result = await runCli(["scan", dirty]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain(`${dirty}:2:6: PHONE_NUMBER`);
    expect(result.stdout).toContain(`${dirty}:2:23: EMAIL_ADDRESS`);
    expect(result.stdout).not.toContain(phone);
    expect(result.stdout).not.toContain(email);
  });

  it("scans stdin and reports EMAIL_ADDRESS without echoing the value", async () => {
    const email = "leak@example.com";
    const result = await runCli(["scan"], { stdin: `${email}\n` });
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("<stdin>:1:1: EMAIL_ADDRESS");
    expect(result.stdout).not.toContain(email);
  });
});

describe("dist/cli.js anonymize (bin smoke)", () => {
  it("masks structured PII with --no-ner --json", async () => {
    const result = await runCli([
      "anonymize",
      "--no-ner",
      "--json",
      "-l",
      "en",
      "-t",
      "Mail john@example.com please",
    ]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.stdout.trim()) as {
      text: string;
      mapping: Record<string, string>;
    };
    expect(parsed.text).toBe("Mail <Email_1> please");
    expect(parsed.mapping).toEqual({ "<Email_1>": "john@example.com" });
    expect(result.stderr).toContain("names and locations will NOT be masked");
  });

  it("reads anonymize input from stdin with --no-ner", async () => {
    const result = await runCli(["anonymize", "--no-ner", "-l", "en"], {
      stdin: "Contact support@example.com\n",
    });
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("Contact <Email_1>");
  });
});
