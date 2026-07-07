/**
 * Records the browser app demo (anonymize -> mapping -> restore round-trip)
 * as a webm screencast, then converts it to an optimized GIF with ffmpeg.
 *
 * Usage (from repo root, after `pnpm --filter @prompt-anonymizer/web build`):
 *   node demo/scripts/record_web.mjs [--lang=ja] [--skip-warmup]
 *   node demo/scripts/record_web.mjs --lang=all
 *
 * Writes demo/demo_web_<lang>.gif. The first run per language downloads the
 * NER model; a warmup pass primes the browser cache in a persistent profile
 * so the recorded pass loads instantly (the profile is reused across
 * languages, so only the very first invocation pays the download cost).
 */

import { execSync, spawn } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { LANGUAGES, langData, parseLangArg } from "./lang-data.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
// playwright lives in the web workspace's node_modules.
const require = createRequire(join(ROOT, "web/package.json"));
const { chromium } = require("playwright");
const DIST = join(ROOT, "web/apps/web/dist");
const OUT = join(ROOT, "demo/out");
const PROFILE = join(OUT, "chrome-profile");
const PORT = 4173;

mkdirSync(OUT, { recursive: true });

// Serve the built app.
const server = spawn("python3", ["-m", "http.server", String(PORT), "-d", DIST], {
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 1000));

async function runPass({ lang, record }) {
  const data = langData(lang);
  const personLabel = data.labels.PERSON;
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    executablePath: process.env.PW_CHROMIUM_PATH,
    viewport: { width: 1240, height: 800 },
    recordVideo: record ? { dir: OUT, size: { width: 1240, height: 800 } } : undefined,
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForTimeout(record ? 1500 : 300);

  await page.selectOption("#language", lang);
  await page.click("#load-sample");
  await page.waitForTimeout(record ? 1200 : 100);
  await page.click("#anonymize");

  // Wait until the anonymized output contains a label.
  await page.waitForFunction(
    (label) => document.querySelector("#output")?.textContent?.includes(`<${label}_1>`),
    personLabel,
    { timeout: 600000 },
  );
  await page.waitForTimeout(record ? 2500 : 100);

  if (record) {
    const restore = page.locator("#restore-input");
    await restore.scrollIntoViewIfNeeded();
    await restore.click();
    await restore.pressSequentially(data.web.llmReply, { delay: 4 });
    await page.waitForTimeout(800);
    await page.click("#restore");
    await page.waitForTimeout(3500);
  }
  await context.close();
}

async function recordLang(lang, { skipWarmup }) {
  console.log(`[${lang}] warmup pass (model download, not recorded)…`);
  if (!skipWarmup) await runPass({ lang, record: false });
  console.log(`[${lang}] recording pass…`);
  await runPass({ lang, record: true });

  // Convert the newest webm (by mtime) to GIF (palettegen for quality).
  const webm = readdirSync(OUT)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => join(OUT, f))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs)
    .pop();
  if (!webm) throw new Error("no webm produced");
  const rawWebm = join(OUT, `web-demo-${lang}.webm`);
  renameSync(webm, rawWebm);
  const out = join(ROOT, `demo/demo_web_${lang}.gif`);
  execSync(
    `ffmpeg -y -i "${rawWebm}" -vf "fps=6,scale=840:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" -loop 0 "${out}"`,
    { stdio: "inherit" },
  );
  console.log(`wrote demo/demo_web_${lang}.gif`);
}

const langArg = parseLangArg(process.argv, "en");
const targets = langArg === "all" ? LANGUAGES : [langArg];
const skipWarmup = process.argv.includes("--skip-warmup");

for (const lang of targets) {
  // Each language may need its own NER model download on first use (the HF
  // model differs per language; see web/packages/core/src/ner.ts), so every
  // language gets its own warmup pass unless the caller opts out.
  await recordLang(lang, { skipWarmup });
}

server.kill();
console.log("done (profile kept in demo/out for reuse)");
