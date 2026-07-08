#!/usr/bin/env node
// Guards user-facing docs against drift from the current release (0.3.x
// registry layout, install paths, MCP coverage, pre-commit rev pins, …).
// Complements check-docs-links.mjs (which only validates links/anchors).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

function latestReleaseVersion() {
  const changelog = read("CHANGELOG.md");
  for (const [, title] of changelog.matchAll(/^## \[([^\]]+)\]/gm)) {
    if (title === "Unreleased") continue;
    if (/^\d+\.\d+\.\d+$/.test(title)) return title;
  }
  throw new Error("CHANGELOG.md: no ## [X.Y.Z] release section found");
}

const release = latestReleaseVersion();
const releaseTag = `v${release}`;
const errors = [];

function fail(file, message) {
  errors.push(`${file}: ${message}`);
}

function checkRegistrySsot(rel, text) {
  if (/languages\.py[`'"\s/]*\/[`'"\s]*types\.ts/.test(text)) {
    fail(rel, "language registry must reference languages.ts, not types.ts");
  }
  if (/`types\.ts`\)\s*plus one label/.test(text)) {
    fail(rel, "language registry must reference languages.ts, not types.ts");
  }
}

function checkPreCommitRev(rel, text) {
  for (const m of text.matchAll(/^\s*rev:\s*(v\d+\.\d+\.\d+)\s*(?:#.*)?$/gm)) {
    if (m[1] !== releaseTag) {
      fail(rel, `pre-commit rev must be ${releaseTag} (latest release), found ${m[1]}`);
    }
  }
}

function checkStaleInstallCaveats(rel, text) {
  const stale = [
    [/git\+https:\/\/github\.com\/akazah\/prompt-anonymizer/, "use pip install prompt-anonymizer instead of git+https"],
    [/non ancora su PyPI/i, "remove stale PyPI caveat"],
    [/non ancora su npm/i, "remove stale npm caveat"],
    [/Non ancora pubblicato su (PyPI|npm)/i, "remove stale install caveat"],
    [/not on PyPI\/npm yet/i, "remove stale PyPI/npm caveat"],
    [/node packages\/cli\/dist\/cli\.js/, "use npx @prompt-anonymizer/cli instead of node packages/cli/dist"],
    [/node packages\/proxy\/dist\/cli\.js/, "use npx @prompt-anonymizer/proxy instead of node packages/proxy/dist"],
  ];
  for (const [re, hint] of stale) {
    if (re.test(text)) fail(rel, hint);
  }
}

function checkPypiPin(rel, text) {
  for (const m of text.matchAll(/prompt-anonymizer==(\d+\.\d+\.\d+)/g)) {
    if (m[1] !== release) {
      fail(rel, `pip install pin must be prompt-anonymizer==${release}, found ==${m[1]}`);
    }
  }
}

function checkMcpCoverage(rel, text) {
  if (!text.includes("npx @prompt-anonymizer/mcp")) {
    fail(rel, "missing npx @prompt-anonymizer/mcp in Try it / usage table");
  }
  if (!/^## .*(MCP|mcp)/m.test(text)) {
    fail(rel, "missing MCP quickstart section (## …MCP… heading)");
  }
}

function checkContributingLinks(rel, text) {
  if (!text.includes("INTEGRATIONS.md")) {
    fail(rel, "Contributing section must link to docs/INTEGRATIONS.md");
  }
  if (!text.includes("AUDIT.md")) {
    fail(rel, "Contributing section must link to docs/AUDIT.md");
  }
}

function checkRoadmapNoFutureMcp(rel, text) {
  const roadmap = text.split(/^## /m).find((chunk) =>
    /^(Roadmap|ロードマップ|Hoja de ruta|Lộ trình|路线图|Roteiro|Feuille de route)\b/m.test(chunk),
  );
  if (!roadmap) return;
  const futureMcp =
    /\b(MCP server|servidor MCP|serveur MCP|Server MCP|MCP-Server|MCP 服务器|MCPサーバー|MCP 서버)\b/i;
  if (futureMcp.test(roadmap)) {
    fail(rel, "roadmap must not list MCP server as future work (shipped in 0.3.0)");
  }
}

// --- README (English) ---
const readme = read("README.md");
checkRegistrySsot("README.md", readme);
checkPreCommitRev("README.md", readme);
checkStaleInstallCaveats("README.md", readme);
checkMcpCoverage("README.md", readme);
checkRoadmapNoFutureMcp("README.md", readme);

// --- Translated READMEs (parity with English surface) ---
const i18nDir = path.join(repoRoot, "docs/i18n");
for (const entry of fs.readdirSync(i18nDir)) {
  if (!/^README_[a-z]{2}\.md$/.test(entry)) continue;
  const rel = `docs/i18n/${entry}`;
  const text = fs.readFileSync(path.join(i18nDir, entry), "utf8");
  checkRegistrySsot(rel, text);
  checkPreCommitRev(rel, text);
  checkStaleInstallCaveats(rel, text);
  checkMcpCoverage(rel, text);
  checkContributingLinks(rel, text);
  checkRoadmapNoFutureMcp(rel, text);
}

// --- Integration recipes ---
const integrations = read("docs/INTEGRATIONS.md");
checkPreCommitRev("docs/INTEGRATIONS.md", integrations);
checkPypiPin("docs/INTEGRATIONS.md", integrations);

// --- Launch draft (published pre-commit snippet) ---
checkPreCommitRev("docs/launch/zenn-article-ja.md", read("docs/launch/zenn-article-ja.md"));

// --- Hook definition comment (copy-paste example) ---
checkPreCommitRev(".pre-commit-hooks.yaml", read(".pre-commit-hooks.yaml"));

if (errors.length > 0) {
  console.error(`Docs freshness check failed (${errors.length}):`);
  for (const e of errors) console.error(`  ${e}`);
  console.error(`\nLatest release (from CHANGELOG): ${releaseTag}`);
  process.exit(1);
}

console.log(
  `docs freshness check OK: registry SSOT, install paths, MCP coverage, ` +
    `pre-commit rev ${releaseTag}, and roadmap pins verified.`,
);
