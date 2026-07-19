/**
 * Shared fixtures for the offline (regex-only) web-app specs.
 *
 * The `blockedExternalRequests` auto-fixture turns the project's P0 privacy
 * guarantee ("your text is never sent to any server") into an executable
 * assertion: every external request attempted during a test is aborted,
 * recorded, and fails the test on teardown.
 */

import { expect, test as base, type Page } from "playwright/test";

export const test = base.extend<{ blockedExternalRequests: string[] }>({
  blockedExternalRequests: [
    async ({ context }, use) => {
      const external: string[] = [];
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
          await route.continue();
          return;
        }
        external.push(url.href);
        await route.abort();
      });
      await use(external);
      expect(external, "PII leak risk: the app attempted external network requests").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

// Mirror of the core registry (web/packages/core/src/types.ts LANGUAGES);
// e2e runs against the built app, so the list is duplicated here.
export const E2E_LANGUAGES = ["en", "ja", "es", "vi", "zh", "ko", "fr", "de", "pt", "it"] as const;
export type E2eLanguage = (typeof E2E_LANGUAGES)[number];

export interface AnonymizeOptions {
  language: E2eLanguage;
  /** Explicit input text; omit to use the app's built-in sample. */
  text?: string;
}

/**
 * Drive the UI end to end with the NER model switched off (offline path).
 *
 * Navigates itself: `?ner=0` keeps model download off. Without explicit
 * `text`, the built-in sample is prefilled and anonymized via a button click;
 * with `text`, `?demo=0` skips sample prefill so output only comes from the
 * explicit input.
 */
export async function anonymizeRegexOnly(
  page: Page,
  { language, text }: AnonymizeOptions,
): Promise<string> {
  if (text === undefined) {
    await page.goto(`/?lang=${language}&ner=0`);
    await page.locator("#anonymize").click();
  } else {
    await page.goto(`/?lang=${language}&ner=0&demo=0`);
    await page.locator("#input").fill(text);
    await page.locator("#anonymize").click();
  }
  await expect(page.locator("#output")).not.toBeEmpty();
  return (await page.locator("#output").textContent()) ?? "";
}

/** Paste `text` into the restore pane and return the restored text. */
export async function restore(page: Page, text: string): Promise<string> {
  await page.locator("#restore-input").fill(text);
  await page.locator("#restore").click();
  const output = page.locator("#restore-output");
  await expect(output).not.toBeEmpty();
  return (await output.textContent()) ?? "";
}
