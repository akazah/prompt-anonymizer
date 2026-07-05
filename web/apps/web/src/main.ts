import {
  Anonymizer,
  RestoreSession,
  TransformersNerBackend,
  detectWebGpu,
  type AnonymizeResult,
  type HintOptions,
  type Language,
  type NerProgress,
} from "@prompt-anonymizer/core";
import "./style.css";

const SAMPLES: Record<Language, string> = {
  ja: "山田太郎は、来月、誕生日を迎えます。どんなプレゼントが適しているでしょうか。山田太郎は、東京都中央区に在住しています。彼のメールアドレスは taro.yamada@example.com、電話番号は 090-1234-5678 です。",
  en: "John Smith will have a birthday next month. What gift would be appropriate? John Smith lives in New York. His email is john@example.com and his mobile is (333) 333-3333.",
};

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div class="container">
    <header>
      <h1>Prompt Anonymizer</h1>
      <span id="engine-badge" class="badge"><span class="dot"></span><span id="engine-name">checking…</span></span>
      <div class="spacer"></div>
      <a class="badge" href="https://github.com/akazah/prompt-anonymizer" target="_blank" rel="noreferrer">GitHub</a>
    </header>
    <p class="privacy">
      <strong>100% on-device.</strong> Detection runs in your browser via WebGPU/WASM —
      your text is never sent to any server. <span lang="ja">テキストはサーバーへ一切送信されません（全処理がブラウザ内で完結します）。</span>
    </p>

    <div class="toolbar">
      <label>Language
        <select id="language">
          <option value="ja">日本語</option>
          <option value="en">English</option>
        </select>
      </label>
      <label><input type="checkbox" id="use-ner" checked /> NER model (names & locations)</label>
      <button id="load-sample">Load sample</button>
      <button id="anonymize" class="primary">Anonymize</button>
    </div>

    <details class="hints-panel">
      <summary>Placeholder hints — keep partial context in labels / ラベルに部分情報を残す</summary>
      <div class="hints-grid">
        <label>Location（住所）
          <select id="hint-location">
            <option value="none" selected>None（残さない）</option>
            <option value="prefecture">Prefecture（都道府県）</option>
            <option value="municipality">Municipality（市区町村）</option>
          </select>
        </label>
        <label>Phone（電話番号）
          <select id="hint-phone">
            <option value="none" selected>None（残さない）</option>
            <option value="lineType">Mobile/Landline（携帯・固定）</option>
            <option value="areaCode">Area code（市外局番）</option>
          </select>
        </label>
        <label>Person（人名）
          <select id="hint-person">
            <option value="none" selected>None（残さない）</option>
            <option value="sharedSurname">Shared surname（同姓関係）</option>
          </select>
        </label>
      </div>
      <p class="hint">Hints keep coarse facts (e.g. <span class="mono">&lt;住所_1:東京都&gt;</span>, <span class="mono">&lt;電話番号_1:携帯&gt;</span>, <span class="mono">&lt;人名_1:同姓A&gt;</span>) inside the label so the LLM has more context — at the cost of revealing that much. ヒントはその分だけ情報が残ります。</p>
    </details>

    <div id="progress" class="progress">
      <div class="bar-outer"><div id="progress-bar" class="bar-inner"></div></div>
      <div id="progress-label" class="label">Loading model…</div>
    </div>

    <div class="grid">
      <section class="panel">
        <h2>Original (stays on your device)</h2>
        <textarea id="input" placeholder="Paste the text you were about to send to an LLM…"></textarea>
      </section>
      <section class="panel">
        <h2>Anonymized (safe to send)</h2>
        <div id="output" class="output"></div>
        <div class="actions">
          <button id="copy">Copy anonymized text</button>
          <span id="copy-flash" class="flash"></span>
        </div>
        <table class="mapping" id="mapping-table" hidden>
          <thead><tr><th>Label</th><th>Original (kept local)</th></tr></thead>
          <tbody></tbody>
        </table>
      </section>
    </div>

    <section class="panel section-restore">
      <h2>Restore (paste the LLM reply)</h2>
      <textarea id="restore-input" placeholder="Paste the LLM response containing labels like <人名_1> …"></textarea>
      <div class="actions">
        <button id="restore" class="primary">Deanonymize</button>
        <button id="copy-restored">Copy restored text</button>
        <span id="restore-flash" class="flash"></span>
      </div>
      <div id="restore-output" class="output" style="margin-top:10px"></div>
      <p id="restore-warning" class="hint warning" hidden></p>
      <p class="hint">Detection is best-effort — always review the anonymized text before sending it anywhere.</p>
    </section>
  </div>
`;

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

let lastResult: AnonymizeResult | null = null;

function onProgress(p: NerProgress): void {
  progressEl.classList.add("visible");
  if (p.status === "progress" && typeof p.progress === "number") {
    progressBar.style.width = `${p.progress.toFixed(0)}%`;
    progressLabel.textContent = `Downloading model: ${p.file ?? ""} ${p.progress.toFixed(0)}%`;
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
  const hasGpu = await detectWebGpu();
  badge.classList.add(hasGpu ? "webgpu" : "wasm");
  name.textContent = hasGpu ? "WebGPU" : "WASM (no WebGPU)";
  badge.title = hasGpu
    ? "Inference is GPU-accelerated in your browser."
    : "WebGPU unavailable; falling back to WebAssembly (slower, still on-device).";
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

function selectedHints(): HintOptions | undefined {
  const location = $<HTMLSelectElement>("#hint-location").value as HintOptions["location"];
  const phone = $<HTMLSelectElement>("#hint-phone").value as HintOptions["phone"];
  const person = $<HTMLSelectElement>("#hint-person").value as HintOptions["person"];
  if (location === "none" && phone === "none" && person === "none") return undefined;
  return { location, phone, person };
}

async function runAnonymize(): Promise<void> {
  const text = inputEl.value;
  if (!text.trim()) return;
  const language = languageEl.value as Language;
  anonymizeBtn.disabled = true;
  anonymizeBtn.textContent = "Working…";
  try {
    const result = await session.anonymize(text, { language, hints: selectedHints() });
    lastResult = result;
    outputEl.innerHTML = renderWithHighlights(result.text, Object.keys(result.mapping), "pii-label");

    const tbody = mappingTable.querySelector("tbody")!;
    tbody.innerHTML = Object.entries(result.mapping)
      .map(
        ([label, original]) =>
          `<tr><td class="label-cell">${escapeHtml(label)}</td><td>${escapeHtml(original)}</td></tr>`,
      )
      .join("");
    mappingTable.hidden = Object.keys(result.mapping).length === 0;
  } catch (error) {
    outputEl.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    anonymizeBtn.disabled = false;
    anonymizeBtn.textContent = "Anonymize";
    progressEl.classList.remove("visible");
  }
}

function flash(el: HTMLElement, message: string): void {
  el.textContent = message;
  setTimeout(() => (el.textContent = ""), 1600);
}

$("#anonymize").addEventListener("click", () => void runAnonymize());
$("#load-sample").addEventListener("click", () => {
  inputEl.value = SAMPLES[languageEl.value as Language];
});
$("#copy").addEventListener("click", () => {
  if (!lastResult) return;
  void navigator.clipboard.writeText(lastResult.text);
  flash($("#copy-flash"), "Copied!");
});
$("#restore").addEventListener("click", () => {
  void (async () => {
    const restoreInput = $<HTMLTextAreaElement>("#restore-input");
    if (!restoreInput.value.trim()) return;
    const result = await session.restore(restoreInput.value);
    $("#restore-output").innerHTML = renderWithHighlights(
      result.text,
      result.replacements.map((r) => r.value),
      "pii-restored",
    );
    const warning = $("#restore-warning");
    warning.hidden = result.unresolved.length === 0;
    warning.textContent = result.unresolved.length
      ? `Unresolved labels (no stored mapping): ${result.unresolved.join(", ")}`
      : "";
  })();
});
$("#copy-restored").addEventListener("click", () => {
  const restored = $("#restore-output").textContent ?? "";
  if (!restored) return;
  void navigator.clipboard.writeText(restored);
  flash($("#restore-flash"), "Copied!");
});
