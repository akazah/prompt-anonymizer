/**
 * Full-pipeline e2e including the transformers.js NER model (names and
 * locations). Opt-in — run with `pnpm e2e:ner` — because the first run
 * downloads the ONNX models from Hugging Face.
 *
 * A persistent browser profile under .cache/ keeps the models in the HTTP
 * cache, so reruns (and cache-restored CI runs) skip the download. Network
 * is allow-listed to localhost + Hugging Face hosts: even with NER on, user
 * text must never leave the device.
 */

import { fileURLToPath } from "node:url";

import { chromium, expect, test, type BrowserContext, type Page } from "playwright/test";

const PROFILE = fileURLToPath(new URL("../.cache/chrome-profile", import.meta.url));
const BASE_URL = "http://127.0.0.1:4173/";
/** First run downloads the model; cached runs finish in seconds. */
const MODEL_READY_TIMEOUT = 600_000;

/**
 * localhost + model weights (Hugging Face) + the ONNX Runtime WASM binary
 * (onnxruntime-web loads it from jsDelivr). All static-asset downloads —
 * anything else, and in particular anything carrying user text, must fail
 * this suite.
 */
const ALLOWED_HOSTS =
  /^(127\.0\.0\.1|localhost|huggingface\.co|.+\.huggingface\.co|.+\.hf\.co|cdn\.jsdelivr\.net)$/;

test.describe.configure({ mode: "serial" });

let context: BrowserContext;
let page: Page;
const disallowedRequests: string[] = [];

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext(PROFILE, {
    viewport: { width: 1240, height: 800 },
  });
  context.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (host && !ALLOWED_HOSTS.test(host)) disallowedRequests.push(request.url());
  });
  page = context.pages()[0] ?? (await context.newPage());
});

test.afterAll(async () => {
  await context?.close();
});

async function anonymizeSample(language: "ja" | "en" | "es" | "vi"): Promise<string> {
  await page.goto(BASE_URL);
  await page.locator("#language").selectOption(language);
  await expect(page.locator("#use-ner")).toBeChecked();
  await page.locator("#load-sample").click();
  await page.locator("#anonymize").click();
  const output = page.locator("#output");
  await expect(output).not.toBeEmpty({ timeout: MODEL_READY_TIMEOUT });
  return (await output.textContent()) ?? "";
}

test("JA: NER masks person names consistently and the round trip restores them", async () => {
  const output = await anonymizeSample("ja");

  // 山田太郎 appears twice in the sample: one label, used everywhere.
  expect(output).not.toContain("山田太郎");
  expect(output).not.toContain("佐藤花子");
  expect(output.match(/<人名_1>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(output).toContain("<人名_2>");
  // Structured recognizers still win alongside NER.
  expect(output).toContain("<メールアドレス_1>");
  expect(output).toContain("<電話番号_1>");

  await page.locator("#restore-input").fill("<人名_1>様、<メールアドレス_1>宛に送付しました。");
  await page.locator("#restore").click();
  const restored = page.locator("#restore-output");
  await expect(restored).toContainText("山田太郎");
  await expect(restored).toContainText("taro.yamada@example.com");
  await expect(page.locator("#restore-warning")).toBeHidden();
});

test("EN: NER masks person names with EN labels", async () => {
  const output = await anonymizeSample("en");

  expect(output).not.toContain("John Smith");
  expect(output).not.toContain("Emily Johnson");
  expect(output.match(/<Name_1>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(output).toContain("<Name_2>");
  expect(output).toContain("<Email_1>");
  expect(output).toContain("<Phone_1>");
});

test("ES: NER masks person names with ES labels", async () => {
  const output = await anonymizeSample("es");

  expect(output).not.toContain("María García");
  expect(output.match(/<Nombre_1>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(output).toContain("<Correo_1>");
  expect(output).toContain("<Teléfono_1>");
});

test("VI: NER masks person names with VI labels", async () => {
  const output = await anonymizeSample("vi");

  expect(output).not.toContain("Nguyễn Văn An");
  expect(output.match(/<Tên_1>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(output).toContain("<Email_1>");
  expect(output).toContain("<SốĐiệnThoại_1>");
});

test("network stayed within localhost + Hugging Face model hosts", () => {
  expect(disallowedRequests).toEqual([]);
});
