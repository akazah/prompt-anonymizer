/**
 * Framework-agnostic `<prompt-anonymizer>` web component.
 *
 * Wires anonymize → LLM → restore through core's `RestoreSession`. The
 * label → original mapping is PII: never log it, never send it over the
 * network, never persist it beyond the injected `MappingStore` (in-memory
 * by default).
 */

import {
  Anonymizer,
  RestoreSession,
  detectLanguage,
  type AnonymizeResult,
  type Language,
  type MappingStore,
  type NerBackend,
  type RestoreResult,
} from "@prompt-anonymizer/core";
import { PANEL_STYLES } from "./styles.js";

const DEFAULT_TAG = "prompt-anonymizer";

function createPanelMarkup(): string {
  return `
    <style>${PANEL_STYLES}</style>
    <div class="panel">
      <p class="ner-warning" hidden>
        NER model is off: names and locations will NOT be masked (only emails, phone numbers, etc.).
        <span lang="ja">NERモデルがオフのため、人名・住所はマスクされません（メールアドレスや電話番号などのみ）。</span>
      </p>
      <div class="toolbar">
        <label>Language
          <select class="language">
            <option value="auto">Auto / 自動判定</option>
            <option value="ja">日本語</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </label>
      </div>
      <textarea class="input" placeholder="Paste the text you were about to send to an LLM…"></textarea>
      <button type="button" class="anonymize">Anonymize</button>
      <div class="output"></div>
      <button type="button" class="copy">Copy</button>
      <table class="mapping" hidden>
        <thead>
          <tr><th>Label</th><th>Original (kept local)</th></tr>
        </thead>
        <tbody></tbody>
      </table>
      <section class="restore">
        <textarea class="restore-input" placeholder="Paste the LLM response containing labels like &lt;人名_1&gt; …"></textarea>
        <button type="button" class="restore">Restore</button>
        <div class="restore-output"></div>
        <p class="unresolved-warning" hidden></p>
      </section>
      <p class="hint">Detection is best-effort — always review the anonymized text before sending it anywhere.</p>
    </div>
  `;
}

/**
 * Register the `<prompt-anonymizer>` custom element. Idempotent; no-ops when
 * `customElements` is unavailable (SSR) or the tag is already defined.
 */
export function definePromptAnonymizer(tagName: string = DEFAULT_TAG): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(tagName)) return;
  customElements.define(tagName, PromptAnonymizerElement);
}

export class PromptAnonymizerElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["language", "show-restore"];
  }

  private _result: AnonymizeResult | null = null;
  private _session: RestoreSession | null = null;
  private _busy = false;
  private _wired = false;

  private _ner?: NerBackend;
  private _store?: MappingStore;
  private _denyList?: string[];
  private _allowList?: string[];
  private _scoreThreshold?: number;

  private readonly nerWarning: HTMLParagraphElement;
  private readonly languageSelect: HTMLSelectElement;
  private readonly inputEl: HTMLTextAreaElement;
  private readonly anonymizeBtn: HTMLButtonElement;
  private readonly outputEl: HTMLDivElement;
  private readonly copyBtn: HTMLButtonElement;
  private readonly mappingTable: HTMLTableElement;
  private readonly mappingBody: HTMLTableSectionElement;
  private readonly restoreSection: HTMLElement;
  private readonly restoreInput: HTMLTextAreaElement;
  private readonly restoreBtn: HTMLButtonElement;
  private readonly restoreOutput: HTMLDivElement;
  private readonly unresolvedWarning: HTMLParagraphElement;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = createPanelMarkup();

    this.nerWarning = shadow.querySelector(".ner-warning")!;
    this.languageSelect = shadow.querySelector("select.language")!;
    this.inputEl = shadow.querySelector("textarea.input")!;
    this.anonymizeBtn = shadow.querySelector("button.anonymize")!;
    this.outputEl = shadow.querySelector("div.output")!;
    this.copyBtn = shadow.querySelector("button.copy")!;
    this.mappingTable = shadow.querySelector("table.mapping")!;
    this.mappingBody = shadow.querySelector("table.mapping tbody")!;
    this.restoreSection = shadow.querySelector("section.restore")!;
    this.restoreInput = shadow.querySelector("textarea.restore-input")!;
    this.restoreBtn = shadow.querySelector("button.restore")!;
    this.restoreOutput = shadow.querySelector("div.restore-output")!;
    this.unresolvedWarning = shadow.querySelector("p.unresolved-warning")!;
  }

  connectedCallback(): void {
    if (this._wired) return;
    this._wired = true;
    this.languageSelect.value = this.language;
    this.updateNerWarning();
    this.updateRestoreVisibility();
    this.wireEvents();
  }

  attributeChangedCallback(name: string): void {
    if (name === "language") {
      this.languageSelect.value = this.language;
    }
    if (name === "show-restore") {
      this.updateRestoreVisibility();
    }
  }

  get language(): "auto" | Language {
    const attr = this.getAttribute("language");
    if (attr === "en" || attr === "ja" || attr === "es" || attr === "vi") return attr;
    return "auto";
  }

  set language(value: "auto" | Language) {
    const next =
      value === "en" || value === "ja" || value === "es" || value === "vi" ? value : "auto";
    if (this.getAttribute("language") !== next) {
      this.setAttribute("language", next);
    }
    this.languageSelect.value = next;
  }

  get showRestore(): boolean {
    return this.getAttribute("show-restore") !== "false";
  }

  set showRestore(value: boolean) {
    if (value) {
      this.removeAttribute("show-restore");
    } else {
      this.setAttribute("show-restore", "false");
    }
    this.updateRestoreVisibility();
  }

  get ner(): NerBackend | undefined {
    return this._ner;
  }

  set ner(value: NerBackend | undefined) {
    this._ner = value;
    this.updateNerWarning();
  }

  get store(): MappingStore | undefined {
    return this._store;
  }

  set store(value: MappingStore | undefined) {
    this._store = value;
    this._session = null;
  }

  get denyList(): string[] | undefined {
    return this._denyList;
  }

  set denyList(value: string[] | undefined) {
    this._denyList = value;
  }

  get allowList(): string[] | undefined {
    return this._allowList;
  }

  set allowList(value: string[] | undefined) {
    this._allowList = value;
  }

  get scoreThreshold(): number | undefined {
    return this._scoreThreshold;
  }

  set scoreThreshold(value: number | undefined) {
    this._scoreThreshold = value;
  }

  get result(): AnonymizeResult | null {
    return this._result;
  }

  private wireEvents(): void {
    this.languageSelect.addEventListener("change", () => {
      this.language = this.languageSelect.value as "auto" | Language;
    });
    this.anonymizeBtn.addEventListener("click", () => void this.runAnonymize());
    this.restoreBtn.addEventListener("click", () => void this.runRestore());
    this.copyBtn.addEventListener("click", () => void this.copyOutput());
  }

  private getSession(): RestoreSession {
    if (!this._session) {
      this._session = new RestoreSession({
        engine: {
          anonymize: (text, options) =>
            new Anonymizer({
              ner: this._ner,
              denyList: this._denyList,
              allowList: this._allowList,
              scoreThreshold: this._scoreThreshold,
            }).anonymize(text, options),
        },
        store: this._store ?? undefined,
      });
    }
    return this._session;
  }

  private async resolveLanguage(text: string): Promise<Language> {
    return this.language === "auto" ? detectLanguage(text) : this.language;
  }

  private setBusy(busy: boolean): void {
    this._busy = busy;
    this.anonymizeBtn.disabled = busy;
    this.restoreBtn.disabled = busy;
  }

  private updateNerWarning(): void {
    this.nerWarning.hidden = this._ner !== undefined;
  }

  private updateRestoreVisibility(): void {
    this.restoreSection.hidden = !this.showRestore;
  }

  private renderMapping(mapping: Record<string, string>): void {
    this.mappingBody.replaceChildren();
    for (const [label, original] of Object.entries(mapping)) {
      const row = document.createElement("tr");
      const labelCell = document.createElement("td");
      labelCell.className = "label-cell";
      labelCell.textContent = label;
      const originalCell = document.createElement("td");
      originalCell.textContent = original;
      row.append(labelCell, originalCell);
      this.mappingBody.append(row);
    }
    this.mappingTable.hidden = Object.keys(mapping).length === 0;
  }

  private dispatchPaEvent<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private async runAnonymize(): Promise<void> {
    const text = this.inputEl.value;
    if (!text.trim() || this._busy) return;

    this.setBusy(true);
    try {
      const language = await this.resolveLanguage(text);
      const result = await this.getSession().anonymize(text, { language });
      this._result = result;
      this.outputEl.textContent = result.text;
      this.renderMapping(result.mapping);
      this.dispatchPaEvent<AnonymizeResult>("pa-anonymize", result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.outputEl.textContent = `Error: ${err.message}`;
      this.dispatchPaEvent<Error>("pa-error", err);
    } finally {
      this.setBusy(false);
    }
  }

  private async runRestore(): Promise<void> {
    const text = this.restoreInput.value;
    if (!text.trim() || this._busy) return;

    this.setBusy(true);
    try {
      const result = await this.getSession().restore(text);
      this.restoreOutput.textContent = result.text;
      this.unresolvedWarning.hidden = result.unresolved.length === 0;
      this.unresolvedWarning.textContent =
        result.unresolved.length > 0
          ? `Unresolved labels (no stored mapping): ${result.unresolved.join(", ")}`
          : "";
      this.dispatchPaEvent<RestoreResult>("pa-restore", result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.restoreOutput.textContent = `Error: ${err.message}`;
      this.dispatchPaEvent<Error>("pa-error", err);
    } finally {
      this.setBusy(false);
    }
  }

  private async copyOutput(): Promise<void> {
    const text = this._result?.text ?? this.outputEl.textContent ?? "";
    if (!text || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(text);
  }
}
