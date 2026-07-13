/**
 * Records the SNS-sized promo videos (demo/social/social_<lang>_<fmt>.mp4)
 * from demo/scripts/social-video.html.
 *
 * Usage (from repo root):
 *   node demo/scripts/record_social.mjs                 # all langs, both formats
 *   node demo/scripts/record_social.mjs --lang=ja --fmt=portrait
 *
 * Formats: portrait = 1080x1920 (Reels / Shorts / TikTok),
 *          square   = 1080x1080 (feed posts). Languages come from the
 * `social` blocks in lang-data.mjs (socialLanguages()).
 *
 * Unlike record_web.mjs this does not record a live screencast: the page
 * exposes seekSocial(t) which pins every animation to an exact timestamp,
 * so each frame is screenshotted deterministically and assembled with
 * ffmpeg (H.264 yuv420p, the codec SNS platforms expect). Needs playwright
 * (from the web workspace), ffmpeg, and a CJK font (e.g. fonts-noto-cjk)
 * for the Japanese variant. Fully offline - no model downloads.
 */

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { langData, socialLanguages } from "./lang-data.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const require = createRequire(join(ROOT, "web/package.json"));
const { chromium } = require("playwright");

const PAGE = join(ROOT, "demo/scripts/social-video.html");
const OUT_DIR = join(ROOT, "demo/social");
const TMP = join(ROOT, "demo/out/social-frames");
const FPS = 30;
const FORMATS = { portrait: { width: 1080, height: 1920 }, square: { width: 1080, height: 1080 } };

function parseArg(argv, name, fallback) {
  const arg = argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : fallback;
}

const langArg = parseArg(process.argv, "lang", "all");
const fmtArg = parseArg(process.argv, "fmt", "all");
const langs = langArg === "all" ? socialLanguages() : [langArg];
const fmts = fmtArg === "all" ? Object.keys(FORMATS) : [fmtArg];
for (const fmt of fmts) {
  if (!FORMATS[fmt]) throw new Error(`Unknown --fmt "${fmt}". Expected: portrait, square, all`);
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });

for (const lang of langs) {
  const social = langData(lang).social;
  if (!social) throw new Error(`Language "${lang}" has no social content in lang-data.mjs`);

  for (const fmt of fmts) {
    const { width, height } = FORMATS[fmt];
    console.log(`[${lang}/${fmt}] rendering frames…`);
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });

    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(pathToFileURL(PAGE).href);
    await page.evaluate((payload) => window.renderSocial(payload), { lang, fmt, social });
    await page.evaluate(() => document.fonts.ready);
    const durationMs = await page.evaluate(() => window.SOCIAL_DURATION_MS);

    const frames = Math.round((durationMs / 1000) * FPS);
    for (let i = 0; i < frames; i++) {
      await page.evaluate((t) => window.seekSocial(t), (i * 1000) / FPS);
      await page.screenshot({
        path: join(TMP, `frame_${String(i).padStart(5, "0")}.jpeg`),
        type: "jpeg",
        quality: 92,
      });
      if (i % 150 === 0) console.log(`[${lang}/${fmt}]   frame ${i}/${frames}`);
    }
    await page.close();

    const out = join(OUT_DIR, `social_${lang}_${fmt}.mp4`);
    execSync(
      `ffmpeg -y -v warning -stats -framerate ${FPS} -i "${join(TMP, "frame_%05d.jpeg")}" ` +
        `-c:v libx264 -pix_fmt yuv420p -crf 23 -preset slow -movflags +faststart "${out}"`,
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    rmSync(TMP, { recursive: true, force: true });
    const size = (readFileSync(out).length / 1024 / 1024).toFixed(2);
    console.log(`wrote demo/social/social_${lang}_${fmt}.mp4 (${size} MB)`);
  }
}

await browser.close();
console.log("done");
