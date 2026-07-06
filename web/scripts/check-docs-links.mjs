#!/usr/bin/env node
// Validates Markdown docs across the repository:
//   - in-page anchor links (#...) resolve to a real heading, using
//     github-slugger (the same slug algorithm GitHub uses, incl. CJK)
//   - relative file links point to files/directories that exist
//   - cross-file anchors (path.md#anchor) resolve in the target file
// Exits 1 with a per-link report when anything is broken.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import GithubSlugger from "github-slugger";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  "target",
  ".venv",
  "venv",
  "test-results",
  "playwright-report",
]);

function collectMarkdownFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...collectMarkdownFiles(path.join(dir, entry.name)));
    } else if (entry.name.endsWith(".md")) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

// Strips fenced code blocks so `# comments` inside ```bash/yaml blocks are
// not parsed as headings and example links are not validated.
function proseLines(markdown) {
  const lines = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) lines.push(line);
  }
  return lines;
}

function headingAnchors(lines) {
  const slugger = new GithubSlugger();
  const anchors = new Set();
  for (const line of lines) {
    const m = line.match(/^#{1,6}\s+(.+?)\s*$/);
    // GitHub slugs the rendered text: drop inline-code backticks and emphasis.
    if (m) anchors.add(slugger.slug(m[1].replace(/`/g, "").replace(/[*_]/g, "")));
  }
  return anchors;
}

const files = collectMarkdownFiles(repoRoot);
const anchorsByFile = new Map(
  files.map((f) => [f, headingAnchors(proseLines(fs.readFileSync(f, "utf8")))]),
);

const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const errors = [];

for (const file of files) {
  const lines = proseLines(fs.readFileSync(file, "utf8"));
  const rel = path.relative(repoRoot, file);
  for (const line of lines) {
    for (const m of line.matchAll(LINK_RE)) {
      const target = m[1];
      if (/^(https?:|mailto:|<)/.test(target)) continue;
      const [filePart, ...anchorParts] = target.split("#");
      const anchor = anchorParts.join("#");
      let targetFile = file;
      if (filePart) {
        targetFile = path.resolve(path.dirname(file), decodeURIComponent(filePart));
        if (!fs.existsSync(targetFile)) {
          errors.push(`${rel}: missing file: ${target}`);
          continue;
        }
      }
      if (anchor) {
        const anchors = anchorsByFile.get(targetFile);
        // Anchors into non-markdown targets (or untracked files) are not checked.
        if (anchors && !anchors.has(decodeURIComponent(anchor).toLowerCase())) {
          errors.push(`${rel}: broken anchor: ${target}`);
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Broken links (${errors.length}):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`docs link check OK: ${files.length} markdown files, all anchors and relative links resolve.`);
