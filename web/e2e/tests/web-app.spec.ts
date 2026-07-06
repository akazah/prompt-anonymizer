/**
 * Browser app e2e: anonymize -> mapping -> restore, all regex-only so the
 * suite is offline and fast. The NER-dependent path lives in ner.spec.ts.
 */

import { anonymizeRegexOnly, expect, restore, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("JA sample: structured PII is masked with consistent labels", async ({ page }) => {
  const output = await anonymizeRegexOnly(page, { language: "ja" });

  expect(output).toContain("<メールアドレス_1>");
  expect(output).toContain("<メールアドレス_2>");
  expect(output).toContain("<電話番号_1>");
  expect(output).not.toContain("taro.yamada@example.com");
  expect(output).not.toContain("hanako.sato@example.com");
  expect(output).not.toContain("090-1234-5678");

  const mappingTable = page.locator("#mapping-table");
  await expect(mappingTable).toBeVisible();
  await expect(mappingTable.locator("tbody tr")).toHaveCount(3);
  await expect(mappingTable).toContainText("taro.yamada@example.com");
  await expect(mappingTable).toContainText("090-1234-5678");
});

test("JA: restoring an LLM-style reply resolves every label", async ({ page }) => {
  await anonymizeRegexOnly(page, { language: "ja" });

  const restored = await restore(
    page,
    "承知しました。<メールアドレス_1> または <電話番号_1> 宛にご連絡ください。",
  );

  expect(restored).toContain("taro.yamada@example.com");
  expect(restored).toContain("090-1234-5678");
  expect(restored).not.toContain("<メールアドレス_1>");
  await expect(page.locator("#restore-warning")).toBeHidden();
});

test("EN sample: masks phone and emails with EN label names", async ({ page }) => {
  const output = await anonymizeRegexOnly(page, { language: "en" });

  expect(output).toContain("<Phone_1>");
  expect(output).toContain("<Email_1>");
  expect(output).toContain("<Email_2>");
  expect(output).not.toContain("(333) 333-3333");
  expect(output).not.toContain("john@example.com");
});

test("repeated values share one label; distinct values get numbered", async ({ page }) => {
  const output = await anonymizeRegexOnly(page, {
    language: "en",
    text: "Mail a@example.com today. Tomorrow mail a@example.com again, then b@example.com.",
  });

  expect(output.match(/<Email_1>/g)).toHaveLength(2);
  expect(output).toContain("<Email_2>");
  await expect(page.locator("#mapping-table tbody tr")).toHaveCount(2);
});

test("unresolved placeholders in the reply are surfaced, not silently kept", async ({ page }) => {
  await anonymizeRegexOnly(page, { language: "en", text: "Contact a@example.com" });

  const restored = await restore(page, "Hi <Name_42>, I mailed <Email_1>.");

  expect(restored).toContain("a@example.com");
  expect(restored).toContain("<Name_42>");
  const warning = page.locator("#restore-warning");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("<Name_42>");
});

test("copy button puts the anonymized text on the clipboard", async ({ page }) => {
  const output = await anonymizeRegexOnly(page, { language: "ja" });

  await page.locator("#copy").click();
  await expect(page.locator("#copy-flash")).toHaveText("Copied!");
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(output);
  expect(clipboard).toContain("<メールアドレス_1>");
});

test("empty input is a no-op", async ({ page }) => {
  await page.locator("#use-ner").uncheck();
  await page.locator("#anonymize").click();
  await expect(page.locator("#output")).toBeEmpty();
  await expect(page.locator("#mapping-table")).toBeHidden();
});

test("NER toggle: on by default, warning shown only while off", async ({ page }) => {
  const useNer = page.locator("#use-ner");
  const warning = page.locator("#ner-off-warning");

  await expect(useNer).toBeChecked();
  await expect(warning).toBeHidden();
  await useNer.uncheck();
  await expect(warning).toBeVisible();
  await useNer.check();
  await expect(warning).toBeHidden();
});
