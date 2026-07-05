// Fail the build early if any file referenced by the manifest is missing.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "../dist");
const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf-8"));

const required = [
  manifest.side_panel.default_path,
  manifest.background.service_worker,
  ...Object.values(manifest.icons),
];

const missing = required.filter((path) => !existsSync(join(dist, path)));
if (missing.length > 0) {
  console.error(`Extension build is missing manifest-referenced files: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("extension postbuild check: OK");
