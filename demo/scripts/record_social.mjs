/**
 * Records SNS / X promo assets from demo/scripts/social-video.html:
 *   - demo/social/social_<lang>_<fmt>.mp4          (~10.5 s video)
 *   - demo/social/social_<lang>_hook_<fmt>.png      (hook still)
 *   - demo/social/social_<lang>_punch_<fmt>.png     (punchline still)
 *
 * Usage (from repo root):
 *   node demo/scripts/record_social.mjs                 # all langs, both formats
 *   node demo/scripts/record_social.mjs --lang=ja --fmt=portrait
 *
 * Formats: portrait = 1080x1920 (Reels / Shorts / TikTok / X),
 *          square   = 1080x1080 (feed posts). Languages come from the
 * `social` blocks in lang-data.mjs (socialLanguages()).
 *
 * Deterministic: seekSocial(t) pins every animation to an exact timestamp,
 * so each frame / still is reproducible. Needs playwright (web workspace),
 * ffmpeg, and a CJK font (e.g. fonts-noto-cjk). Fully offline.
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
    console.log(`[${lang}/${fmt}] rendering…`);
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });

    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(pathToFileURL(PAGE).href);
    await page.evaluate((payload) => window.renderSocial(payload), { lang, fmt, social });
    await page.evaluate(() => document.fonts.ready);
    const durationMs = await page.evaluate(() => window.SOCIAL_DURATION_MS);
    const stills = await page.evaluate(() => window.SOCIAL_STILLS);

    // Still PNGs first (hook + punchline) — same seek path as the video.
    for (const [name, tMs] of Object.entries(stills)) {
      await page.evaluate((t) => window.seekSocial(t), tMs);
      const stillPath = join(OUT_DIR, `social_${lang}_${name}_${fmt}.png`);
      await page.screenshot({ path: stillPath, type: "png" });
      const kb = (readFileSync(stillPath).length / 1024).toFixed(0);
      console.log(`  wrote demo/social/social_${lang}_${name}_${fmt}.png (${kb} KB)`);
    }

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
