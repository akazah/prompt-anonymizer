/**
 * Records the Chrome extension side panel demo as a GIF.
 *
 * The real side panel page (from the built extension) is loaded with a small
 * chrome.* shim standing in for the service-worker plumbing, simulating the
 * "right-click -> Anonymize selection" hand-off. Regex recognizers only
 * (NER unchecked) so the recording is instant and needs no model downloads.
 *
 * Usage: node demo/scripts/record_extension.mjs [--lang=ja]
 *        node demo/scripts/record_extension.mjs --lang=all
 *   (after `pnpm --filter @prompt-anonymizer/extension build`)
 *
 * Writes demo/demo_extension_<lang>.gif.
 */

import { execSync, spawn } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { LANGUAGES, langData, parseLangArg } from "./lang-data.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const require = createRequire(join(ROOT, "web/package.json"));
const { chromium } = require("playwright");

const DIST = join(ROOT, "web/apps/extension/dist");
const OUT = join(ROOT, "demo/out");
const PORT = 4174;

mkdirSync(OUT, { recursive: true });

async function recordLang(lang) {
  const data = langData(lang);
  const phoneLabel = data.labels.PHONE_NUMBER;
  const selection = data.extension.selection;

  const server = spawn("python3", ["-m", "http.server", String(PORT), "-d", DIST], {
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 1000));

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PW_CHROMIUM_PATH,
  });
  const context = await browser.newContext({
    viewport: { width: 420, height: 760 },
    recordVideo: { dir: OUT, size: { width: 420, height: 760 } },
  });
  const page = await context.newPage();

  await page.addInitScript(`
    const data = { pendingText: ${JSON.stringify(selection)} };
    window.chrome = {
      storage: {
        session: {
          async get(key) { return { [key]: data[key] }; },
          async set(obj) { Object.assign(data, obj); },
          async remove(key) { delete data[key]; },
          onChanged: { addListener() {} },
        },
      },
    };
  `);

  await page.goto(`http://localhost:${PORT}/sidepanel.html`);
  // Turn NER off before the auto-run kicks in is racy; instead re-run after unchecking.
  await page.waitForTimeout(1200);
  await page.selectOption("#language", lang);
  await page.uncheck("#use-ner");
  await page.click("#anonymize");
  await page.waitForFunction(
    (label) => document.querySelector("#output")?.textContent?.includes(`<${label}_1>`),
    phoneLabel,
    { timeout: 60000 },
  );
  await page.waitForTimeout(2200);

  await page.click("#tab-restore");
  await page.waitForTimeout(600);
  const restore = page.locator("#restore-input");
  await restore.click();
  await restore.pressSequentially(data.extension.restore, { delay: 18 });
  await page.waitForTimeout(500);
  await page.click("#restore");
  await page.waitForTimeout(2500);

  await context.close();
  await browser.close();
  server.kill();

  const webm = readdirSync(OUT)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => join(OUT, f))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs)
    .pop();
  if (!webm) throw new Error("no webm produced");
  const rawWebm = join(OUT, `extension-demo-${lang}.webm`);
  renameSync(webm, rawWebm);
  const out = join(ROOT, `demo/demo_extension_${lang}.gif`);
  execSync(
    `ffmpeg -y -loglevel error -i "${rawWebm}" -vf "fps=8,scale=420:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" -loop 0 "${out}"`,
    { stdio: "inherit" },
  );
  console.log(`wrote demo/demo_extension_${lang}.gif`);
}

const langArg = parseLangArg(process.argv, "ja");
const targets = langArg === "all" ? LANGUAGES : [langArg];
for (const lang of targets) await recordLang(lang);
