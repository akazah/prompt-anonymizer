/**
 * Minimal static file server for e2e runs (no extra dependencies).
 *
 * Serves an already-built app directory so the e2e suite reuses the exact
 * artifact CI ships, instead of rebuilding through `vite preview`.
 *
 * Usage: node scripts/serve.mjs <dist-dir> <port>
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const [dirArg, portArg] = process.argv.slice(2);
if (!dirArg || !portArg) {
  console.error("usage: node scripts/serve.mjs <dist-dir> <port>");
  process.exit(1);
}

const root = resolve(import.meta.dirname, "..", dirArg);
const port = Number(portArg);

if (!existsSync(join(root, "index.html"))) {
  console.error(
    `serve.mjs: ${root} has no index.html — build the apps first (cd web && pnpm build).`,
  );
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = normalize(join(root, pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`serving ${root} at http://127.0.0.1:${port}/`);
});
