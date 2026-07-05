/**
 * Records the browser app demo (anonymize -> mapping -> restore round-trip)
 * as a webm screencast, then converts it to an optimized GIF with ffmpeg.
 *
 * Usage (from repo root, after `pnpm --filter @prompt-anonymizer/web build`):
 *   node demo/scripts/record_web.mjs [--skip-warmup]
 *
 * The first run downloads the NER model; a warmup pass primes the browser
 * cache in a persistent profile so the recorded pass loads instantly.
 */

import { execSync, spawn } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
// playwright lives in the web workspace's node_modules.
const require = createRequire(join(ROOT, "web/package.json"));
const { chromium } = require("playwright");
const DIST = join(ROOT, "web/apps/web/dist");
const OUT = join(ROOT, "demo/out");
const PROFILE = join(OUT, "chrome-profile");
const PORT = 4173;

const LLM_REPLY =
  "<人名_1>様\n" +
  "いつもお世話になっております。この度、弊社オフィスは <住所_1> へ移転いたします。\n" +
  "ご不明な点がございましたら <電話番号_1> または <メールアドレス_1> までご連絡ください。";

mkdirSync(OUT, { recursive: true });

// Serve the built app.
const server = spawn("python3", ["-m", "http.server", String(PORT), "-d", DIST], {
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 1000));

async function runPass({ record }) {
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    viewport: { width: 1240, height: 800 },
    recordVideo: record ? { dir: OUT, size: { width: 1240, height: 800 } } : undefined,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(record ? 1500 : 300);

  await page.click("#load-sample");
  await page.waitForTimeout(record ? 1200 : 100);
  await page.click("#anonymize");

  // Wait until the anonymized output contains a label.
  await page.waitForFunction(
    () => document.querySelector("#output")?.textContent?.includes("<人名_1>"),
    { timeout: 600000 },
  );
  await page.waitForTimeout(record ? 2500 : 100);

  if (record) {
    const restore = page.locator("#restore-input");
    await restore.scrollIntoViewIfNeeded();
    await restore.click();
    await restore.pressSequentially(LLM_REPLY, { delay: 4 });
    await page.waitForTimeout(800);
    await page.click("#restore");
    await page.waitForTimeout(3500);
  }
  await context.close();
}

console.log("warmup pass (model download, not recorded)…");
if (!process.argv.includes("--skip-warmup")) await runPass({ record: false });
console.log("recording pass…");
await runPass({ record: true });

server.kill();

// Convert the newest webm (by mtime) to GIF (palettegen for quality).
const webm = readdirSync(OUT)
  .filter((f) => f.endsWith(".webm"))
  .map((f) => join(OUT, f))
  .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs)
  .pop();
if (!webm) throw new Error("no webm produced");
renameSync(webm, join(OUT, "web-demo.webm"));
execSync(
  `ffmpeg -y -i "${join(OUT, "web-demo.webm")}" -vf "fps=6,scale=840:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" -loop 0 "${join(ROOT, "demo/demo_web.gif")}"`,
  { stdio: "inherit" },
);
console.log("wrote demo/demo_web.gif (profile kept in demo/out for reuse)");
