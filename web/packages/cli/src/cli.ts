#!/usr/bin/env node
import readline from "node:readline/promises";
import { run, type CliIo } from "./main.js";

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8");
}

async function confirm(prompt: string): Promise<boolean> {
  // Same behaviour as the Python CLI's input(): reads from stdin, so
  // --interactive expects the text via --text/--file rather than a pipe.
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    for (;;) {
      const answer = (await rl.question(prompt)).trim();
      if (answer === "Y") return true;
      if (answer === "n") return false;
      process.stderr.write("Please answer 'Y' or 'n'.\n");
    }
  } finally {
    rl.close();
  }
}

const io: CliIo = {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
  readStdin,
  confirm,
};

run(process.argv.slice(2), io)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
