import { defineConfig, devices } from "playwright/test";

const CI = !!process.env.CI;

/**
 * Two tiers, mirroring the Python suite's `not slow` / `slow` split:
 *
 * - `web` + `extension` (default): regex recognizers only, fully offline and
 *   deterministic — every test asserts that no request leaves localhost.
 *   Runs on every PR against the already-built `dist/` artifacts.
 * - `ner` (opt-in via E2E_NER=1 / --project=ner): full transformers.js
 *   pipeline including the model download. The browser profile is kept in
 *   `.cache/` so the multi-hundred-MB models download only once per machine
 *   (and are restored from actions/cache in the weekly workflow).
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "web",
      testMatch: /web-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["clipboard-read", "clipboard-write"],
      },
    },
    {
      // Loads the real MV3 extension; the spec manages its own persistent
      // context (extensions need `channel: "chromium"`), so no `use` here.
      name: "extension",
      testMatch: /extension\.spec\.ts/,
    },
    ...(process.env.E2E_NER
      ? [
          {
            name: "ner",
            testMatch: /ner\.spec\.ts/,
            // First run downloads the NER models (JA + EN) inside the page.
            timeout: 900_000,
          },
        ]
      : []),
  ],
  webServer: {
    command: "node scripts/serve.mjs ../apps/web/dist 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !CI,
  },
});
