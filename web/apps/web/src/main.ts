import {
  Anonymizer,
  RestoreSession,
  TransformersNerBackend,
  detectLanguage,
  detectWebGpu,
  languageFromBcp47,
  languagePickerEntries,
  SAMPLES,
  type AnonymizeResult,
  type Language,
  type LanguageOption,
  type NerProgress,
} from "@prompt-anonymizer/core";
import "@prompt-anonymizer/theme/fonts.css";
import "./style.css";
import {
  resolveUiLanguage,
  restorePlaceholderFor,
  t,
  type UiMessageKey,
} from "./ui-i18n.js";

function sampleLanguageFromNavigator(): Language {
  return languageFromBcp47(navigator.language ?? "") ?? "en";
}

const ICON_SHIELD = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.5 4.5 5.6v5.1c0 4.6 3.2 8.9 7.5 10.3 4.3-1.4 7.5-5.7 7.5-10.3V5.6L12 2.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m8.8 11.8 2.2 2.2 4.2-4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_LOCK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_SEND = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12 20 4l-4.5 16-4-6.5L4 12Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const ICON_RESTORE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9a8 8 0 1 1-1 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 4v5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function languageOptionsMarkup(uiLang: Language): string {
  return languagePickerEntries({ auto: true })
    .map(({ value, label }) => {
      const text = value === "auto" ? t(uiLang, "auto") : label;
      return `<option value="${value}">${text}</option>`;
    })
    .join("\n          ");
}

function renderShell(uiLang: Language): string {
  return `
  <div class="container">
    <div class="hero">
      <header>
        <span class="logo-mark">${ICON_SHIELD}</span>
        <h1>Prompt Anonymizer</h1>
        <span id="engine-badge" class="badge"><span class="dot"></span><span id="engine-name">${t(uiLang, "checking")}</span></span>
        <div class="spacer"></div>
        <a class="badge" href="https://github.com/akazah/prompt-anonymizer" target="_blank" rel="noreferrer">GitHub</a>
      </header>
      <p class="privacy">
        <strong data-i18n="privacyLead">${t(uiLang, "privacyLead")}</strong>
        <span data-i18n="privacyBody">${t(uiLang, "privacyBody")}</span>
      </p>
    </div>

    <div class="toolbar">
      <label><span data-i18n="language">${t(uiLang, "language")}</span>
        <select id="language">
          ${languageOptionsMarkup(uiLang)}
        </select>
      </label>
      <label class="switch-label"><input type="checkbox" id="use-ner" class="switch" checked /> <span data-i18n="nerModel">${t(uiLang, "nerModel")}</span></label>
      <div class="spacer"></div>
      <button id="load-sample" data-i18n="loadSample">${t(uiLang, "loadSample")}</button>
      <button id="anonymize" class="primary" data-i18n="anonymize">${t(uiLang, "anonymize")}</button>
    </div>
    <p id="ner-off-warning" class="hint warning" data-i18n="nerOffWarning" hidden>
      ${t(uiLang, "nerOffWarning")}
    </p>

    <div id="progress" class="progress">
      <div class="bar-outer"><div id="progress-bar" class="bar-inner"></div></div>
      <div id="progress-label" class="label" data-i18n="loadingModel">${t(uiLang, "loadingModel")}</div>
    </div>

    <div class="grid">
      <section class="panel">
        <h2>${ICON_LOCK}<span data-i18n="originalHeading">${t(uiLang, "originalHeading")}</span></h2>
        <textarea id="input" data-i18n-placeholder="inputPlaceholder" placeholder="${t(uiLang, "inputPlaceholder")}"></textarea>
      </section>
      <section class="panel">
        <h2>${ICON_SEND}<span data-i18n="anonymizedHeading">${t(uiLang, "anonymizedHeading")}</span></h2>
        <div id="output" class="output"></div>
        <div class="actions">
          <button id="copy" data-i18n="copyAnonymized">${t(uiLang, "copyAnonymized")}</button>
          <span id="copy-flash" class="flash"></span>
        </div>
        <table class="mapping" id="mapping-table" hidden>
          <thead><tr><th data-i18n="mappingLabel">${t(uiLang, "mappingLabel")}</th><th data-i18n="mappingOriginal">${t(uiLang, "mappingOriginal")}</th></tr></thead>
          <tbody></tbody>
        </table>
      </section>
    </div>

    <section class="panel section-restore">
      <h2>${ICON_RESTORE}<span data-i18n="restoreHeading">${t(uiLang, "restoreHeading")}</span></h2>
      <textarea id="restore-input" placeholder="${restorePlaceholderFor(uiLang)}"></textarea>
      <div class="actions">
        <button id="restore" class="primary" data-i18n="deanonymize">${t(uiLang, "deanonymize")}</button>
        <button id="copy-restored" data-i18n="copyRestored">${t(uiLang, "copyRestored")}</button>
        <span id="restore-flash" class="flash"></span>
      </div>
      <div id="restore-output" class="output" style="margin-top:10px"></div>
      <p id="restore-warning" class="hint warning" hidden></p>
      <p class="hint" data-i18n="restoreHint">${t(uiLang, "restoreHint")}</p>
    </section>
  </div>
`;
}

const app = document.querySelector<HTMLDivElement>("#app")!;
let uiLanguage: Language = resolveUiLanguage("auto");
app.innerHTML = renderShell(uiLanguage);
document.documentElement.lang = uiLanguage;
document.title = t(uiLanguage, "pageTitle");
const metaDescription = document.querySelector('meta[name="description"]');
if (metaDescription) metaDescription.setAttribute("content", t(uiLanguage, "pageDescription"));

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const inputEl = $<HTMLTextAreaElement>("#input");
const outputEl = $("#output");
const languageEl = $<HTMLSelectElement>("#language");
const useNerEl = $<HTMLInputElement>("#use-ner");
const progressEl = $("#progress");
const progressBar = $("#progress-bar");
const progressLabel = $("#progress-label");
const mappingTable = $<HTMLTableElement>("#mapping-table");
const anonymizeBtn = $<HTMLButtonElement>("#anonymize");
const nerOffWarning = $("#ner-off-warning");

let busy = false;

function applyUiLocale(lang: Language): void {
  uiLanguage = lang;
  document.documentElement.lang = lang;
  document.title = t(lang, "pageTitle");
  if (metaDescription) metaDescription.setAttribute("content", t(lang, "pageDescription"));

  // Keep the selected value while refreshing the Auto option's label.
  const selected = languageEl.value;
  languageEl.innerHTML = languageOptionsMarkup(lang);
  languageEl.value = selected;

  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = el.dataset.i18n as UiMessageKey | undefined;
    if (!key) continue;
    // Don't clobber the anonymize button while a run is in progress.
    if (el === anonymizeBtn && busy) continue;
    el.textContent = t(lang, key);
  }

  for (const el of document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
    "[data-i18n-placeholder]",
  )) {
    const key = el.dataset.i18nPlaceholder as UiMessageKey | undefined;
    if (key) el.placeholder = t(lang, key);
  }

  $<HTMLTextAreaElement>("#restore-input").placeholder = restorePlaceholderFor(lang);

  if (!busy) {
    progressLabel.textContent = t(lang, "loadingModel");
  }
  void updateEngineBadge();
}

function syncNerWarning(): void {
  nerOffWarning.hidden = useNerEl.checked;
}
useNerEl.addEventListener("change", syncNerWarning);
syncNerWarning();

languageEl.addEventListener("change", () => {
  applyUiLocale(resolveUiLanguage(languageEl.value as LanguageOption));
});

let lastResult: AnonymizeResult | null = null;

function onProgress(p: NerProgress): void {
  progressEl.classList.add("visible");
  if (p.status === "progress" && typeof p.progress === "number") {
    progressBar.style.width = `${p.progress.toFixed(0)}%`;
    progressLabel.textContent = `${t(uiLanguage, "downloadingModel")} ${p.file ?? ""} ${p.progress.toFixed(0)}%`;
  } else if (p.status === "ready") {
    progressEl.classList.remove("visible");
  } else {
    progressLabel.textContent = p.status;
  }
}

const ner = new TransformersNerBackend({ onProgress });
const anonymizerWithNer = new Anonymizer({ ner });
const anonymizerRegexOnly = new Anonymizer();

// Restore flow goes through the core RestoreSession service; this app only
// injects an engine (NER toggle) and keeps the default in-memory store.
const session = new RestoreSession({
  engine: {
    anonymize: (text, options) =>
      (useNerEl.checked ? anonymizerWithNer : anonymizerRegexOnly).anonymize(text, options),
  },
});

async function updateEngineBadge(): Promise<void> {
  const badge = $("#engine-badge");
  const name = $("#engine-name");
  // Before the first model load, guess from adapter detection; afterwards
  // report the device the pipeline actually initialized on (WebGPU adapters
  // can exist yet fail ONNX Runtime init, triggering the WASM fallback).
  const usesGpu = ner.device ? ner.device === "webgpu" : await detectWebGpu();
  badge.classList.remove("webgpu", "wasm");
  badge.classList.add(usesGpu ? "webgpu" : "wasm");
  name.textContent = usesGpu ? "WebGPU" : t(uiLanguage, "wasmBadge");
  badge.title = usesGpu ? t(uiLanguage, "engineWebgpuTitle") : t(uiLanguage, "engineWasmTitle");
}
void updateEngineBadge();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderWithHighlights(text: string, labels: string[], cls: string): string {
  let html = escapeHtml(text);
  for (const label of [...labels].sort((a, b) => b.length - a.length)) {
    const esc = escapeHtml(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(esc, "g"), `<span class="${cls}">${escapeHtml(label)}</span>`);
  }
  return html;
}

async function resolveLanguage(text: string): Promise<Language> {
  // "Auto" resolves on-device: Chrome's built-in LanguageDetector when
  // available, a script heuristic otherwise.
  const value = languageEl.value;
  return value === "auto" ? detectLanguage(text) : (value as Language);
}

async function runAnonymize(): Promise<void> {
  const text = inputEl.value;
  if (!text.trim()) return;
  const language = await resolveLanguage(text);
  busy = true;
  anonymizeBtn.disabled = true;
  anonymizeBtn.textContent = t(uiLanguage, "working");
  try {
    const result = await session.anonymize(text, { language });
    lastResult = result;
    outputEl.innerHTML = renderWithHighlights(result.text, Object.keys(result.mapping), "pii-label");
    replayAppear(outputEl);

    const tbody = mappingTable.querySelector("tbody")!;
    tbody.innerHTML = Object.entries(result.mapping)
      .map(
        ([label, original]) =>
          `<tr><td class="label-cell">${escapeHtml(label)}</td><td>${escapeHtml(original)}</td></tr>`,
      )
      .join("");
    mappingTable.hidden = Object.keys(result.mapping).length === 0;
  } catch (error) {
    outputEl.textContent = `${t(uiLanguage, "errorPrefix")} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    busy = false;
    anonymizeBtn.disabled = false;
    anonymizeBtn.textContent = t(uiLanguage, "anonymize");
    progressEl.classList.remove("visible");
    void updateEngineBadge();
  }
}

function replayAppear(el: HTMLElement): void {
  el.classList.remove("appear");
  void el.offsetWidth;
  el.classList.add("appear");
}

function flash(el: HTMLElement, message: string): void {
  el.textContent = message;
  setTimeout(() => (el.textContent = ""), 1600);
}

$("#anonymize").addEventListener("click", () => void runAnonymize());
$("#load-sample").addEventListener("click", () => {
  const value = languageEl.value;
  const language: Language =
    value === "auto" ? sampleLanguageFromNavigator() : (value as Language);
  inputEl.value = SAMPLES[language];
});
$("#copy").addEventListener("click", () => {
  if (!lastResult) return;
  void navigator.clipboard.writeText(lastResult.text);
  flash($("#copy-flash"), t(uiLanguage, "copied"));
});
$("#restore").addEventListener("click", () => {
  void (async () => {
    const restoreInput = $<HTMLTextAreaElement>("#restore-input");
    if (!restoreInput.value.trim()) return;
    const result = await session.restore(restoreInput.value);
    const restoreOutput = $("#restore-output");
    restoreOutput.innerHTML = renderWithHighlights(
      result.text,
      result.replacements.map((r) => r.value),
      "pii-restored",
    );
    replayAppear(restoreOutput);
    const warning = $("#restore-warning");
    warning.hidden = result.unresolved.length === 0;
    warning.textContent = result.unresolved.length
      ? `${t(uiLanguage, "unresolvedLabels")} ${result.unresolved.join(", ")}`
      : "";
  })();
});
$("#copy-restored").addEventListener("click", () => {
  const restored = $("#restore-output").textContent ?? "";
  if (!restored) return;
  void navigator.clipboard.writeText(restored);
  flash($("#restore-flash"), t(uiLanguage, "copied"));
});
