import {
  Anonymizer,
  RestoreSession,
  TransformersNerBackend,
  detectLanguage,
  isLanguageOption,
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
  demoTransformFor,
  t,
  type UiMessageKey,
} from "./ui-i18n.js";

function sampleLanguageFromNavigator(): Language {
  return languageFromBcp47(navigator.language ?? "") ?? "en";
}

/**
 * Startup options via query string (shareable / used by tests):
 *   ?lang=ja   preselect a language ("auto" or a supported code)
 *   ?ner=0     start with the NER model switched off (offline regex-only)
 *   ?demo=0    skip pre-filling the sample text on load
 */
const startupParams = new URLSearchParams(location.search);
const isOff = (value: string | null): boolean =>
  value !== null && ["0", "off", "false", "no"].includes(value);

const ICON_SHIELD = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.5 4.5 5.6v5.1c0 4.6 3.2 8.9 7.5 10.3 4.3-1.4 7.5-5.7 7.5-10.3V5.6L12 2.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m8.8 11.8 2.2 2.2 4.2-4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_LOCK = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_SEND = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12 20 4l-4.5 16-4-6.5L4 12Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const ICON_RESTORE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9a8 8 0 1 1-1 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 4v5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

type FlowStep = "original" | "anonymized" | "restore";

const FLOW_STEPS: { id: FlowStep; labelKey: UiMessageKey }[] = [
  { id: "original", labelKey: "flowOriginal" },
  { id: "anonymized", labelKey: "flowAnonymized" },
  { id: "restore", labelKey: "flowRestore" },
];

function languageOptionsMarkup(uiLang: Language): string {
  return languagePickerEntries({ auto: true })
    .map(({ value, label }) => {
      const text = value === "auto" ? t(uiLang, "auto") : label;
      return `<option value="${value}">${text}</option>`;
    })
    .join("\n          ");
}

function flowStepperMarkup(uiLang: Language): string {
  return FLOW_STEPS.map((step, i) => {
    const connector = i < FLOW_STEPS.length - 1 ? `<li class="flow-connector" aria-hidden="true"></li>` : "";
    const label = t(uiLang, step.labelKey);
    return `<li class="flow-step" data-step="${step.id}">
        <button type="button" class="flow-dot" aria-label="${label}">${i + 1}</button>
        <span class="flow-label" data-i18n="${step.labelKey}">${label}</span>
      </li>${connector}`;
  }).join("\n        ");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderShell(uiLang: Language): string {
  const demo = demoTransformFor(uiLang);
  return `
  <div class="container">
    <header class="hero">
      <span class="logo-mark">${ICON_SHIELD}</span>
      <h1>Prompt Anonymizer</h1>
      <div class="hero-summary">
        <p class="value-pitch" data-i18n="valuePitch">${t(uiLang, "valuePitch")}</p>
        <div class="value-demo" aria-hidden="true">
          <span class="demo-pii">${escapeHtml(demo.pii)}</span>
          <span class="demo-arrow">→</span>
          <span class="demo-label">${escapeHtml(demo.label)}</span>
        </div>
      </div>
      <a class="badge" href="https://github.com/akazah/prompt-anonymizer" target="_blank" rel="noreferrer">GitHub</a>
    </header>

    <div class="toolbar">
      <label><span data-i18n="language">${t(uiLang, "language")}</span>
        <select id="language">
          ${languageOptionsMarkup(uiLang)}
        </select>
      </label>
      <label class="switch-label" title="${t(uiLang, "nerModel")}"><input type="checkbox" id="use-ner" class="switch" checked aria-label="${t(uiLang, "nerModel")}" /> <span data-i18n="nerModel">${t(uiLang, "nerModel")}</span></label>
      <span id="ner-off-warning" class="ner-warning" data-i18n="nerOffWarning" hidden>
        ${t(uiLang, "nerOffWarning")}
      </span>
      <div class="spacer"></div>
      <button id="anonymize" class="primary" title="${t(uiLang, "anonymize")}">
        <span class="anonymize-long" data-i18n="anonymize">${t(uiLang, "anonymize")}</span>
        <span class="anonymize-short">
          <span class="anonymize-short-main" data-i18n="anonymizeShort">${t(uiLang, "anonymizeShort")}</span>
          <span class="anonymize-short-sub" data-i18n="anonymizeHint">${t(uiLang, "anonymizeHint")}</span>
        </span>
        <span class="anonymize-working" data-i18n="working" hidden>${t(uiLang, "working")}</span>
      </button>
    </div>

    <div id="progress" class="progress">
      <div class="bar-outer"><div id="progress-bar" class="bar-inner"></div></div>
      <div id="progress-label" class="label" data-i18n="loadingModel">${t(uiLang, "loadingModel")}</div>
    </div>

    <nav id="flow-stepper" class="flow-stepper" aria-label="Workflow">
      <ol class="flow-steps">
        ${flowStepperMarkup(uiLang)}
      </ol>
    </nav>

    <div id="grid" class="grid" data-active-step="original">
      <section class="panel" data-panel="original">
        <h2>${ICON_LOCK}<span data-i18n="originalHeading">${t(uiLang, "originalHeading")}</span><span class="panel-tag panel-tag-local" data-i18n="tagLocal">${t(uiLang, "tagLocal")}</span></h2>
        <textarea id="input" data-i18n-placeholder="inputPlaceholder" placeholder="${t(uiLang, "inputPlaceholder")}"></textarea>
      </section>
      <section class="panel" data-panel="anonymized">
        <h2>${ICON_SEND}<span data-i18n="anonymizedHeading">${t(uiLang, "anonymizedHeading")}</span><span class="panel-tag panel-tag-safe" data-i18n="tagSafe">${t(uiLang, "tagSafe")}</span></h2>
        <div id="output" class="output" data-empty="${t(uiLang, "outputEmpty")}"></div>
        <div class="actions">
          <button id="copy" data-i18n="copyAnonymized">${t(uiLang, "copyAnonymized")}</button>
          <button id="open-restore" type="button" data-i18n="openRestore" disabled>${t(uiLang, "openRestore")}</button>
          <span id="copy-flash" class="flash"></span>
        </div>
        <div class="mapping-wrap">
          <table class="mapping" id="mapping-table" hidden>
            <thead><tr><th data-i18n="mappingLabel">${t(uiLang, "mappingLabel")}</th><th aria-hidden="true">→</th><th data-i18n="mappingOriginal">${t(uiLang, "mappingOriginal")}</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </section>
      <section class="panel section-restore" data-panel="restore">
        <h2>${ICON_RESTORE}<span data-i18n="restoreHeading">${t(uiLang, "restoreHeading")}</span></h2>
        <textarea id="restore-input" placeholder="${restorePlaceholderFor(uiLang)}"></textarea>
        <div class="actions">
          <button id="restore" class="primary" data-i18n="deanonymize">${t(uiLang, "deanonymize")}</button>
          <button id="copy-restored" data-i18n="copyRestored">${t(uiLang, "copyRestored")}</button>
          <span id="restore-flash" class="flash"></span>
        </div>
        <div id="restore-output" class="output" data-empty="${t(uiLang, "restoreOutputEmpty")}"></div>
        <p id="restore-warning" class="hint warning" hidden></p>
      </section>
    </div>
  </div>
`;
}

const app = document.querySelector<HTMLDivElement>("#app")!;
const startupLang = startupParams.get("lang");
const initialLangOption: LanguageOption =
  startupLang !== null && isLanguageOption(startupLang) ? startupLang : "auto";
let uiLanguage: Language = resolveUiLanguage(initialLangOption);
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
const openRestoreBtn = $<HTMLButtonElement>("#open-restore");
const nerOffWarning = $("#ner-off-warning");
const gridEl = $("#grid");
const flowStepperEl = $("#flow-stepper");

if (initialLangOption !== "auto") languageEl.value = initialLangOption;
if (isOff(startupParams.get("ner"))) useNerEl.checked = false;

let busy = false;
const completedSteps = new Set<FlowStep>();

function setActiveStep(step: FlowStep): void {
  gridEl.dataset.activeStep = step;
  for (const el of flowStepperEl.querySelectorAll<HTMLElement>(".flow-step")) {
    const id = el.dataset.step as FlowStep;
    const isActive = id === step;
    el.classList.toggle("active", isActive);
    el.classList.toggle("done", completedSteps.has(id));
    el.querySelector<HTMLButtonElement>(".flow-dot")?.setAttribute(
      "aria-current",
      isActive ? "step" : "false",
    );
  }
}

function markStepDone(step: FlowStep): void {
  completedSteps.add(step);
  flowStepperEl.querySelector<HTMLElement>(`.flow-step[data-step="${step}"]`)?.classList.add("done");
}

flowStepperEl.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>(".flow-dot");
  if (!btn) return;
  const step = btn.closest<HTMLElement>(".flow-step")?.dataset.step as FlowStep | undefined;
  if (step) setActiveStep(step);
});

setActiveStep("original");

function applyUiLocale(lang: Language): void {
  uiLanguage = lang;
  document.documentElement.lang = lang;
  document.title = t(lang, "pageTitle");
  if (metaDescription) metaDescription.setAttribute("content", t(lang, "pageDescription"));

  const selected = languageEl.value;
  languageEl.innerHTML = languageOptionsMarkup(lang);
  languageEl.value = selected;

  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = el.dataset.i18n as UiMessageKey | undefined;
    if (!key) continue;
    if (anonymizeBtn.contains(el) && busy) continue;
    el.textContent = t(lang, key);
  }
  anonymizeBtn.title = t(lang, "anonymize");

  for (const el of document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>(
    "[data-i18n-placeholder]",
  )) {
    const key = el.dataset.i18nPlaceholder as UiMessageKey | undefined;
    if (key) el.placeholder = t(lang, key);
  }

  $<HTMLTextAreaElement>("#restore-input").placeholder = restorePlaceholderFor(lang);
  outputEl.dataset.empty = t(lang, "outputEmpty");
  $("#restore-output").dataset.empty = t(lang, "restoreOutputEmpty");

  const demo = demoTransformFor(lang);
  const demoPii = document.querySelector(".demo-pii");
  const demoLabel = document.querySelector(".demo-label");
  if (demoPii) demoPii.textContent = demo.pii;
  if (demoLabel) demoLabel.textContent = demo.label;

  if (!busy) {
    progressLabel.textContent = t(lang, "loadingModel");
  }
  syncAnonymizeBtnLabel();
}

function syncAnonymizeBtnLabel(): void {
  const long = anonymizeBtn.querySelector<HTMLElement>(".anonymize-long");
  const short = anonymizeBtn.querySelector<HTMLElement>(".anonymize-short");
  const working = anonymizeBtn.querySelector<HTMLElement>(".anonymize-working");
  if (!long || !short || !working) return;
  working.hidden = !busy;
  long.hidden = busy;
  short.hidden = busy;
  anonymizeBtn.classList.toggle("busy", busy);
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

function syncOpenRestoreBtn(): void {
  openRestoreBtn.disabled = !lastResult;
}

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

const anonymizerRegexOnly = new Anonymizer();
let nerBackend: TransformersNerBackend | null = null;
let anonymizerWithNer: Anonymizer | null = null;

function anonymizerForRun(): Anonymizer {
  if (!useNerEl.checked) return anonymizerRegexOnly;
  if (!anonymizerWithNer) {
    nerBackend = new TransformersNerBackend({ onProgress });
    anonymizerWithNer = new Anonymizer({ ner: nerBackend });
  }
  return anonymizerWithNer;
}

const session = new RestoreSession({
  engine: {
    anonymize: (text, options) => anonymizerForRun().anonymize(text, options),
  },
});

function renderWithHighlights(text: string, labels: string[], cls: string): string {
  let html = escapeHtml(text);
  for (const label of [...labels].sort((a, b) => b.length - a.length)) {
    const esc = escapeHtml(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(esc, "g"), `<span class="${cls}">${escapeHtml(label)}</span>`);
  }
  return html;
}

async function resolveLanguage(text: string): Promise<Language> {
  const value = languageEl.value;
  return value === "auto" ? detectLanguage(text) : (value as Language);
}

async function runAnonymize(): Promise<void> {
  const text = inputEl.value;
  if (!text.trim()) return;
  const language = await resolveLanguage(text);
  busy = true;
  anonymizeBtn.disabled = true;
  syncAnonymizeBtnLabel();
  try {
    const result = await session.anonymize(text, { language });
    lastResult = result;
    outputEl.innerHTML = renderWithHighlights(result.text, Object.keys(result.mapping), "pii-label");
    replayAppear(outputEl);

    const tbody = mappingTable.querySelector("tbody")!;
    tbody.innerHTML = Object.entries(result.mapping)
      .map(
        ([label, original]) =>
          `<tr><td class="label-cell">${escapeHtml(label)}</td><td class="mapping-arrow" aria-hidden="true">→</td><td class="value-cell">${escapeHtml(original)}</td></tr>`,
      )
      .join("");
    mappingTable.hidden = Object.keys(result.mapping).length === 0;
    markStepDone("original");
    setActiveStep("anonymized");
    syncOpenRestoreBtn();
  } catch (error) {
    outputEl.textContent = `${t(uiLanguage, "errorPrefix")} ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    busy = false;
    anonymizeBtn.disabled = false;
    syncAnonymizeBtnLabel();
    progressEl.classList.remove("visible");
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
$("#copy").addEventListener("click", () => {
  if (!lastResult) return;
  void navigator.clipboard.writeText(lastResult.text);
  flash($("#copy-flash"), t(uiLanguage, "copied"));
});
$("#open-restore").addEventListener("click", () => {
  if (!lastResult) return;
  const restoreInput = $<HTMLTextAreaElement>("#restore-input");
  restoreInput.value = lastResult.text;
  $("#restore-output").textContent = "";
  $("#restore-warning").hidden = true;
  setActiveStep("restore");
  restoreInput.focus();
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
    markStepDone("restore");
  })();
});
$("#copy-restored").addEventListener("click", () => {
  const restored = $("#restore-output").textContent ?? "";
  if (!restored) return;
  void navigator.clipboard.writeText(restored);
  flash($("#restore-flash"), t(uiLanguage, "copied"));
});

if (!isOff(startupParams.get("demo"))) {
  const value = languageEl.value;
  const language: Language =
    value === "auto" ? sampleLanguageFromNavigator() : (value as Language);
  inputEl.value = SAMPLES[language];
}
