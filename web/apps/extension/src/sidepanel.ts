import {
  Anonymizer,
  RestoreSession,
  TransformersNerBackend,
  type AnonymizeResult,
  type Language,
  type MappingStore,
  type NerProgress,
} from "@prompt-anonymizer/core";
import "./sidepanel.css";

/**
 * MappingStore adapter for this target: the mapping lives in
 * chrome.storage.session only, so it survives side-panel reloads but is
 * dropped when the browser closes. Never use chrome.storage.local here —
 * the mapping contains the original PII.
 */
class ChromeSessionMappingStore implements MappingStore {
  private static readonly KEY = "mapping";

  async load(): Promise<Record<string, string> | null> {
    const stored = await chrome.storage.session.get(ChromeSessionMappingStore.KEY);
    return (stored[ChromeSessionMappingStore.KEY] as Record<string, string> | undefined) ?? null;
  }

  async save(mapping: Record<string, string>): Promise<void> {
    await chrome.storage.session.set({ [ChromeSessionMappingStore.KEY]: mapping });
  }

  async clear(): Promise<void> {
    await chrome.storage.session.remove(ChromeSessionMappingStore.KEY);
  }
}

const panel = document.querySelector<HTMLDivElement>("#panel")!;
panel.innerHTML = `
  <div class="wrap">
    <h1>Prompt Anonymizer</h1>
    <p class="privacy"><strong>On-device.</strong> Your text never leaves this browser. / テキストは外部へ送信されません。</p>

    <div class="tabs">
      <button id="tab-anon" class="active">Anonymize</button>
      <button id="tab-restore">Restore</button>
    </div>

    <div id="view-anon">
      <textarea id="input" placeholder="Select text on a page → right-click → 'Anonymize selection', or paste here."></textarea>
      <div class="row" style="margin-top:8px">
        <select id="language">
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
        <label style="font-size:12px;color:var(--text-dim)"><input type="checkbox" id="use-ner" checked /> NER</label>
        <button id="anonymize" class="btn primary">Anonymize</button>
      </div>
      <p id="ner-off-warning" class="warning" hidden>NER off: names & locations will NOT be masked. / 人名・住所はマスクされません。</p>
      <div id="progress" class="progress"></div>
      <div id="output" class="output" style="margin-top:8px"></div>
      <div class="row" style="margin-top:6px">
        <button id="copy" class="btn">Copy</button>
        <span id="copy-flash" class="flash"></span>
      </div>
      <table id="mapping-table" class="hidden" style="margin-top:8px">
        <thead><tr><th>Label</th><th>Original</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>

    <div id="view-restore" class="hidden">
      <textarea id="restore-input" placeholder="Paste the LLM reply containing labels…"></textarea>
      <div class="row" style="margin-top:8px">
        <button id="restore" class="btn primary">Deanonymize</button>
        <button id="copy-restored" class="btn">Copy</button>
        <span id="restore-flash" class="flash"></span>
      </div>
      <div id="restore-output" class="output" style="margin-top:8px"></div>
      <p id="restore-warning" class="warning" hidden></p>
    </div>
  </div>
`;

const $ = <T extends HTMLElement>(sel: string) => panel.querySelector<T>(sel)!;
const inputEl = $<HTMLTextAreaElement>("#input");
const outputEl = $("#output");
const progressEl = $("#progress");
const anonymizeBtn = $<HTMLButtonElement>("#anonymize");

let lastResult: AnonymizeResult | null = null;

function onProgress(p: NerProgress): void {
  if (p.status === "progress" && typeof p.progress === "number") {
    progressEl.textContent = `Downloading model: ${p.progress.toFixed(0)}% (cached after first use)`;
  } else if (p.status === "ready") {
    progressEl.textContent = "";
  }
}

const ner = new TransformersNerBackend({ onProgress });
const withNer = new Anonymizer({ ner });
const regexOnly = new Anonymizer();

const useNerEl = $<HTMLInputElement>("#use-ner");
const nerOffWarning = $("#ner-off-warning");
function syncNerWarning(): void {
  nerOffWarning.hidden = useNerEl.checked;
}
useNerEl.addEventListener("change", syncNerWarning);
syncNerWarning();

// Shared restore flow from core; this target only injects its storage adapter.
const session = new RestoreSession({
  engine: {
    anonymize: (text, options) =>
      (useNerEl.checked ? withNer : regexOnly).anonymize(text, options),
  },
  store: new ChromeSessionMappingStore(),
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(text: string, needles: string[], cls: string): string {
  let html = escapeHtml(text);
  for (const needle of [...needles].sort((a, b) => b.length - a.length)) {
    const esc = escapeHtml(needle).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(esc, "g"), `<span class="${cls}">${escapeHtml(needle)}</span>`);
  }
  return html;
}

function guessLanguage(text: string): Language {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(text) ? "ja" : "en";
}

async function runAnonymize(): Promise<void> {
  const text = inputEl.value;
  if (!text.trim()) return;
  const language = $<HTMLSelectElement>("#language").value as Language;
  anonymizeBtn.disabled = true;
  try {
    // RestoreSession persists the mapping via ChromeSessionMappingStore.
    const result = await session.anonymize(text, { language });
    lastResult = result;
    outputEl.innerHTML = highlight(result.text, Object.keys(result.mapping), "pii-label");
    const table = $<HTMLTableElement>("#mapping-table");
    table.querySelector("tbody")!.innerHTML = Object.entries(result.mapping)
      .map(
        ([label, original]) =>
          `<tr><td class="label-cell">${escapeHtml(label)}</td><td>${escapeHtml(original)}</td></tr>`,
      )
      .join("");
    table.classList.toggle("hidden", Object.keys(result.mapping).length === 0);
  } catch (error) {
    outputEl.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    anonymizeBtn.disabled = false;
    progressEl.textContent = "";
  }
}

function flash(el: HTMLElement, message: string): void {
  el.textContent = message;
  setTimeout(() => (el.textContent = ""), 1500);
}

$("#anonymize").addEventListener("click", () => void runAnonymize());
$("#copy").addEventListener("click", () => {
  if (!lastResult) return;
  void navigator.clipboard.writeText(lastResult.text);
  flash($("#copy-flash"), "Copied!");
});
$("#restore").addEventListener("click", async () => {
  const value = $<HTMLTextAreaElement>("#restore-input").value;
  if (!value.trim()) return;
  const result = await session.restore(value);
  $("#restore-output").innerHTML = highlight(
    result.text,
    result.replacements.map((r) => r.value),
    "pii-restored",
  );
  const warning = $("#restore-warning");
  warning.hidden = result.unresolved.length === 0;
  warning.textContent = result.unresolved.length
    ? `Unresolved labels (no stored mapping): ${result.unresolved.join(", ")}`
    : "";
});
$("#copy-restored").addEventListener("click", () => {
  const restored = $("#restore-output").textContent ?? "";
  if (!restored) return;
  void navigator.clipboard.writeText(restored);
  flash($("#restore-flash"), "Copied!");
});

function switchTab(tab: "anon" | "restore"): void {
  $("#view-anon").classList.toggle("hidden", tab !== "anon");
  $("#view-restore").classList.toggle("hidden", tab !== "restore");
  $("#tab-anon").classList.toggle("active", tab === "anon");
  $("#tab-restore").classList.toggle("active", tab === "restore");
}
$("#tab-anon").addEventListener("click", () => switchTab("anon"));
$("#tab-restore").addEventListener("click", () => switchTab("restore"));

// Receive text sent from the context menu (background service worker).
async function consumePendingText(): Promise<void> {
  const stored = await chrome.storage.session.get("pendingText");
  const pending = stored["pendingText"] as string | undefined;
  if (pending) {
    inputEl.value = pending;
    $<HTMLSelectElement>("#language").value = guessLanguage(pending);
    void chrome.storage.session.remove("pendingText");
    switchTab("anon");
    void runAnonymize();
  }
}
chrome.storage.session.onChanged.addListener((changes) => {
  if (changes["pendingText"]?.newValue) void consumePendingText();
});
void consumePendingText();
