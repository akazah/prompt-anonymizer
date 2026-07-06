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

export interface AnonymizeOptions {
  language: "ja" | "en";
  /** Explicit input text; omit to use the app's built-in sample. */
  text?: string;
}

/** Drive the UI end to end with the NER model switched off (offline path). */
export async function anonymizeRegexOnly(
  page: Page,
  { language, text }: AnonymizeOptions,
): Promise<string> {
  await page.locator("#language").selectOption(language);
  await page.locator("#use-ner").uncheck();
  if (text === undefined) {
    await page.locator("#load-sample").click();
  } else {
    await page.locator("#input").fill(text);
  }
  await page.locator("#anonymize").click();
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
