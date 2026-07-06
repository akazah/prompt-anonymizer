/**
 * Post-build step: compile the admin GUI and copy it into `dist/ui/`.
 * Skips gracefully when the admin app is absent (stripped-down checkouts).
 */

import { execSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = join(packageDir, "..", "..");
const adminDir = join(webRoot, "apps", "proxy-admin");
const adminDist = join(adminDir, "dist");
const dest = join(packageDir, "dist", "ui");

if (!existsSync(adminDir)) {
  console.warn(
    "warning: proxy-admin app not found — skipping UI copy (admin GUI unavailable until built)",
  );
  process.exit(0);
}

execSync("pnpm --filter @prompt-anonymizer/proxy-admin build", {
  stdio: "inherit",
  cwd: webRoot,
});

if (!existsSync(adminDist)) {
  console.warn("warning: proxy-admin build produced no dist/ — skipping UI copy");
  process.exit(0);
}

cpSync(adminDist, dest, { recursive: true });
console.log(`copied admin UI to ${dest}`);
