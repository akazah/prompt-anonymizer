/**
 * Chrome extension e2e: the real MV3 build is loaded into Chromium
 * (channel "chromium" — extensions need the full browser, not the headless
 * shell). Covers the service-worker hand-off that the context menu uses,
 * the chrome.storage.session mapping persistence, and the manifest's
 * privacy surface. Regex-only (NER unchecked), so fully offline.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { chromium, expect, test as base, type BrowserContext, type Page } from "playwright/test";

const EXTENSION_DIST = fileURLToPath(new URL("../../apps/extension/dist", import.meta.url));

/** chrome.* as visible inside the extension service worker (evaluate scope). */
declare const chrome: {
  storage: { session: { set(items: Record<string, unknown>): Promise<void> } };
};

const SELECTION =
  "お世話になっております。件の請求書を再送します。" +
  "宛先: 〒150-0002 東京都渋谷区、TEL 090-1234-5678、" +
  "メール taro.yamada@example.com までお願いします。";

const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [
        `--disable-extensions-except=${EXTENSION_DIST}`,
        `--load-extension=${EXTENSION_DIST}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let worker = context.serviceWorkers()[0];
    worker ??= await context.waitForEvent("serviceworker");
    await use(new URL(worker.url()).host);
  },
});

test.beforeAll(() => {
  if (!existsSync(`${EXTENSION_DIST}/manifest.json`)) {
    throw new Error("extension dist missing — run `cd web && pnpm build` first");
  }
});

/** Record any request that is not served from the extension itself. */
function trackExternalRequests(page: Page): string[] {
  const external: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("chrome-extension://")) external.push(request.url());
  });
  return external;
}

async function openSidePanel(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(page.locator("#anonymize")).toBeVisible();
  return page;
}

test("manifest privacy surface: only HF model hosts and minimal permissions", () => {
  const manifest = JSON.parse(readFileSync(`${EXTENSION_DIST}/manifest.json`, "utf-8")) as {
    permissions: string[];
    host_permissions: string[];
  };

  expect(manifest.permissions.sort()).toEqual(["contextMenus", "sidePanel", "storage"]);
  // Any new host permission means text could reach a new origin — P0 review.
  expect(manifest.host_permissions.sort()).toEqual([
    "https://*.hf.co/*",
    "https://huggingface.co/*",
  ]);
});

test("context-menu hand-off: pendingText auto-anonymizes in the side panel", async ({
  context,
  extensionId,
}) => {
  const page = await openSidePanel(context, extensionId);
  const external = trackExternalRequests(page);
  await page.locator("#use-ner").uncheck();

  // Same hand-off the background service worker performs on menu click.
  const worker = context.serviceWorkers()[0]!;
  await worker.evaluate(
    (text) => chrome.storage.session.set({ pendingText: text }),
    SELECTION,
  );

  await expect(page.locator("#input")).toHaveValue(SELECTION);
  await expect(page.locator("#language")).toHaveValue("ja"); // auto-detected
  const output = page.locator("#output");
  await expect(output).toContainText("<郵便番号_1>");
  await expect(output).toContainText("<電話番号_1>");
  await expect(output).toContainText("<メールアドレス_1>");
  await expect(output).not.toContainText("090-1234-5678");
  await expect(page.locator("#mapping-table tbody tr")).toHaveCount(3);

  expect(external, "extension side panel must not call out (NER off)").toEqual([]);
});

test("mapping survives a side-panel reload via chrome.storage.session", async ({
  context,
  extensionId,
}) => {
  const page = await openSidePanel(context, extensionId);
  await page.locator("#use-ner").uncheck();
  await page.locator("#input").fill(SELECTION);
  await page.locator("#anonymize").click();
  await expect(page.locator("#output")).toContainText("<メールアドレス_1>");

  await page.reload();
  await expect(page.locator("#anonymize")).toBeVisible();

  await page.locator("#tab-restore").click();
  await page.locator("#restore-input").fill("再送先: <メールアドレス_1>（<電話番号_1>）");
  await page.locator("#restore").click();

  const restored = page.locator("#restore-output");
  await expect(restored).toContainText("taro.yamada@example.com");
  await expect(restored).toContainText("090-1234-5678");
  await expect(page.locator("#restore-warning")).toBeHidden();
});
