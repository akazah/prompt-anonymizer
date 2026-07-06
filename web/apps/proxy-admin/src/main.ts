import {
  getConfig,
  getEventMapping,
  getEvents,
  getStatus,
  postPreview,
  putConfig,
  type ProxyConfig,
  type ProxyStatus,
  type RedactionEvent,
} from "./api";
import "./style.css";

const SAMPLES = {
  ja: "山田太郎は、来月、誕生日を迎えます。同僚の佐藤花子は、サプライズパーティーを計画しています。どんなプレゼントが適しているでしょうか。山田太郎は、東京都中央区に在住しています。彼のメールアドレスは taro.yamada@example.com、電話番号は 090-1234-5678 です。佐藤花子への連絡は hanako.sato@example.com までお願いします。",
  en: "John Smith will have a birthday next month. His colleague Emily Johnson is planning a surprise party. What gift would be appropriate? John Smith lives in New York. His email is john@example.com and his mobile is (333) 333-3333. You can reach Emily Johnson at emily.johnson@example.com.",
} as const;

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <div class="container">
    <header>
      <h1>Prompt Anonymizer — Proxy Admin</h1>
      <span id="proxy-badge" class="badge down"><span class="dot"></span><span id="proxy-status-text">proxy: offline</span></span>
      <span id="version-badge" class="badge version">v—</span>
      <div class="spacer"></div>
      <a class="badge" href="https://github.com/akazah/prompt-anonymizer" target="_blank" rel="noreferrer">GitHub</a>
    </header>
    <p class="privacy">
      <strong>100% localhost.</strong> This admin UI and the proxy run on your machine —
      only <em>anonymized</em> text is sent to your configured upstream; mappings stay in proxy memory.
      <span lang="ja">マッピングはプロキシのメモリ内にのみ保持され、元の個人情報は上流へ送信されません。</span>
    </p>

    <section class="panel" id="status-panel">
      <h2>Status</h2>
      <div class="status-grid" id="status-grid">
        <div class="status-card"><div class="label">Upstream</div><div class="value mono" id="stat-upstream">—</div></div>
        <div class="status-card"><div class="label">Listen</div><div class="value mono" id="stat-listen">—</div></div>
        <div class="status-card"><div class="label">NER</div><div class="value" id="stat-ner">—</div></div>
        <div class="status-card"><div class="label">Language</div><div class="value" id="stat-language">—</div></div>
        <div class="status-card"><div class="label">Uptime</div><div class="value mono" id="stat-uptime">—</div></div>
        <div class="status-card"><div class="label">Requests</div><div class="value mono" id="stat-requests">—</div></div>
      </div>
    </section>

    <section class="panel" id="config-panel">
      <h2>Configuration</h2>
      <div class="form-row">
        <label class="field-label" for="cfg-upstream">Upstream URL</label>
        <div class="field-control">
          <input type="text" id="cfg-upstream" placeholder="https://api.openai.com" />
        </div>
      </div>
      <div class="form-row">
        <label class="field-label">NER model</label>
        <div class="field-control">
          <label><input type="checkbox" id="cfg-ner" checked /> NER model (names &amp; locations)</label>
        </div>
      </div>
      <p id="ner-off-warning" class="hint warning" hidden>
        NER model is off: names and locations will NOT be masked (only emails, phone numbers, etc.).
        <span lang="ja">NERモデルがオフのため、人名・住所はマスクされません（メールアドレスや電話番号などのみ）。</span>
      </p>
      <div class="form-row">
        <label class="field-label" for="cfg-language">Language</label>
        <div class="field-control">
          <select id="cfg-language">
            <option value="auto">Auto / 自動判定</option>
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <label class="field-label" for="cfg-deny">Deny list</label>
        <div class="field-control">
          <textarea id="cfg-deny" placeholder="One string per line — always masked"></textarea>
        </div>
      </div>
      <div class="form-row">
        <label class="field-label" for="cfg-allow">Allow list</label>
        <div class="field-control">
          <textarea id="cfg-allow" placeholder="One string per line — never masked"></textarea>
        </div>
      </div>
      <div class="form-row">
        <label class="field-label">Record mappings</label>
        <div class="field-control">
          <label><input type="checkbox" id="cfg-record-mappings" /> Keep label → original mappings in proxy memory</label>
        </div>
      </div>
      <p id="record-mappings-warning" class="hint warning" hidden>
        Enabling this keeps original PII in proxy memory so you can reveal it in the events table below.
        Mappings are never written to disk.
      </p>
      <div class="actions">
        <button id="save-config" class="primary">Save</button>
        <span id="save-flash" class="flash"></span>
      </div>
      <p id="config-error" class="hint warning" hidden></p>
    </section>

    <section class="panel" id="events-panel">
      <div class="panel-header">
        <h2>Recent requests</h2>
        <div class="spacer"></div>
        <button id="refresh-events">Refresh</button>
      </div>
      <div id="events-container"></div>
    </section>

    <section class="panel" id="playground-panel">
      <h2>Preview anonymization</h2>
      <div class="toolbar">
        <label>Language
          <select id="preview-language">
            <option value="auto">Auto / 自動判定</option>
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </label>
        <button id="load-sample">Load sample</button>
        <button id="preview-btn" class="primary">Preview anonymization</button>
      </div>
      <textarea id="preview-input" placeholder="Paste text to anonymize locally…"></textarea>
      <p class="hint">Preview runs entirely on this machine — nothing is sent upstream.</p>
      <div id="preview-output" class="output" style="margin-top:10px"></div>
      <table class="mapping" id="preview-mapping" hidden>
        <thead><tr><th>Label</th><th>Original (kept local)</th></tr></thead>
        <tbody></tbody>
      </table>
    </section>
  </div>
`;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const proxyBadge = $("#proxy-badge");
const proxyStatusText = $("#proxy-status-text");
const versionBadge = $("#version-badge");
const nerOffWarning = $("#ner-off-warning");
const recordMappingsWarning = $("#record-mappings-warning");
const configError = $("#config-error");
const eventsContainer = $("#events-container");
const previewOutput = $("#preview-output");
const previewMapping = $<HTMLTableElement>("#preview-mapping");

/** Event IDs whose mapping row is expanded. */
const revealedIds = new Set<number>();
/** Cached mapping HTML per event id (avoids re-fetch on toggle). */
const mappingCache = new Map<number, string>();
let lastEvents: RedactionEvent[] = [];

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

function flash(el: HTMLElement, message: string): void {
  el.textContent = message;
  setTimeout(() => (el.textContent = ""), 1600);
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return escapeHtml(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function linesToText(lines: string[]): string {
  return lines.join("\n");
}

function languageLabel(lang: string): string {
  if (lang === "auto") return "Auto / 自動判定";
  if (lang === "ja") return "日本語";
  if (lang === "en") return "English";
  return lang;
}

function setProxyOnline(online: boolean): void {
  proxyBadge.classList.remove("ok", "down");
  proxyBadge.classList.add(online ? "ok" : "down");
  proxyStatusText.textContent = online ? "proxy: online" : "proxy: offline";
}

function populateConfigForm(config: ProxyConfig): void {
  $<HTMLInputElement>("#cfg-upstream").value = config.upstreamUrl;
  $<HTMLInputElement>("#cfg-ner").checked = config.ner;
  $<HTMLSelectElement>("#cfg-language").value = config.language;
  $<HTMLTextAreaElement>("#cfg-deny").value = linesToText(config.denyList);
  $<HTMLTextAreaElement>("#cfg-allow").value = linesToText(config.allowList);
  $<HTMLInputElement>("#cfg-record-mappings").checked = config.recordMappings;
  syncWarnings();
}

function readConfigForm(): Partial<ProxyConfig> {
  const language = $<HTMLSelectElement>("#cfg-language").value;
  return {
    upstreamUrl: $<HTMLInputElement>("#cfg-upstream").value.trim(),
    ner: $<HTMLInputElement>("#cfg-ner").checked,
    language: language === "auto" || language === "ja" || language === "en" ? language : "auto",
    denyList: parseLines($<HTMLTextAreaElement>("#cfg-deny").value),
    allowList: parseLines($<HTMLTextAreaElement>("#cfg-allow").value),
    recordMappings: $<HTMLInputElement>("#cfg-record-mappings").checked,
  };
}

function syncWarnings(): void {
  nerOffWarning.hidden = $<HTMLInputElement>("#cfg-ner").checked;
  recordMappingsWarning.hidden = !$<HTMLInputElement>("#cfg-record-mappings").checked;
}

function renderStatus(status: ProxyStatus): void {
  versionBadge.textContent = `v${status.version}`;
  $("#stat-upstream").textContent = status.config.upstreamUrl;
  $("#stat-listen").textContent = `${status.host}:${status.port}`;
  const nerOn = status.config.ner;
  const nerReady = status.nerReady;
  $("#stat-ner").textContent = nerOn
    ? nerReady
      ? "On (ready)"
      : "On (loading…)"
    : "Off";
  $("#stat-language").textContent = languageLabel(status.config.language);
  $("#stat-uptime").textContent = formatUptime(status.uptimeSeconds);
  const r = status.requests;
  $("#stat-requests").textContent = `${r.total} total · ${r.anonymized} anonymized · ${r.passthrough} passthrough · ${r.errors} errors`;
}

function formatEntityCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return "—";
  return entries.map(([type, n]) => `${escapeHtml(type)}×${n}`).join(" ");
}

function formatStatus(event: RedactionEvent): string {
  if (event.status === "ok") return "ok";
  if (event.upstreamStatus !== undefined) {
    return `${event.status} (${event.upstreamStatus})`;
  }
  return event.status;
}

function renderMappingTable(mapping: Record<string, string>): string {
  const rows = Object.entries(mapping)
    .map(
      ([label, original]) =>
        `<tr><td class="label-cell">${escapeHtml(label)}</td><td>${escapeHtml(original)}</td></tr>`,
    )
    .join("");
  return `<table class="mapping"><thead><tr><th>Label</th><th>Original (kept local)</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderEvents(events: RedactionEvent[]): void {
  lastEvents = events;
  if (events.length === 0) {
    eventsContainer.innerHTML = `<table class="events"><tbody><tr><td class="empty" colspan="9">No requests recorded yet.</td></tr></tbody></table>`;
    return;
  }

  const rows = events
    .map((ev) => {
      const statusCls = ev.status === "ok" ? "status-ok" : "status-warn";
      const labelsHtml = ev.labels.length
        ? ev.labels.map((l) => `<span class="chip">${escapeHtml(l)}</span>`).join("")
        : "—";
      const revealBtn = ev.hasMapping
        ? `<button type="button" class="reveal-btn" data-id="${ev.id}">${revealedIds.has(ev.id) ? "Hide" : "Reveal"}</button>`
        : "";
      const mappingRow = revealedIds.has(ev.id)
        ? `<tr class="mapping-row" data-mapping-for="${ev.id}"><td colspan="9">${mappingCache.get(ev.id) ?? '<span class="hint">Loading…</span>'}</td></tr>`
        : "";

      return `
        <tr class="event-row" data-event-id="${ev.id}">
          <td>${formatTime(ev.timestamp)}</td>
          <td class="mono">${escapeHtml(ev.path)}</td>
          <td>${escapeHtml(ev.model ?? "—")}</td>
          <td>${escapeHtml(ev.language)}</td>
          <td>${ev.stream ? "↯" : "—"}</td>
          <td class="entities">${formatEntityCounts(ev.entityCounts)}</td>
          <td>${labelsHtml}</td>
          <td>${ev.durationMs}</td>
          <td class="${statusCls}">${escapeHtml(formatStatus(ev))} ${revealBtn}</td>
        </tr>
        ${mappingRow}`;
    })
    .join("");

  eventsContainer.innerHTML = `
    <table class="events">
      <thead>
        <tr>
          <th>Time</th><th>Path</th><th>Model</th><th>Lang</th><th>Stream</th>
          <th>Entities</th><th>Labels</th><th>ms</th><th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function toggleReveal(id: number): Promise<void> {
  if (revealedIds.has(id)) {
    revealedIds.delete(id);
    renderEvents(lastEvents);
    return;
  }

  revealedIds.add(id);
  renderEvents(lastEvents);

  if (!mappingCache.has(id)) {
    try {
      const res = await getEventMapping(id);
      mappingCache.set(id, renderMappingTable(res.mapping));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      mappingCache.set(id, `<p class="hint warning">${escapeHtml(msg)}</p>`);
    }
    renderEvents(lastEvents);
  }
}

async function refreshStatusAndEvents(): Promise<void> {
  try {
    const [status, events] = await Promise.all([getStatus(), getEvents(50)]);
    setProxyOnline(true);
    renderStatus(status);
    renderEvents(events);
  } catch {
    setProxyOnline(false);
  }
}

async function loadInitialConfig(): Promise<void> {
  try {
    const config = await getConfig();
    populateConfigForm(config);
    setProxyOnline(true);
  } catch {
    setProxyOnline(false);
  }
}

// --- Event listeners ---

$<HTMLInputElement>("#cfg-ner").addEventListener("change", syncWarnings);
$<HTMLInputElement>("#cfg-record-mappings").addEventListener("change", syncWarnings);

$("#save-config").addEventListener("click", () => {
  void (async () => {
    configError.hidden = true;
    const saveBtn = $<HTMLButtonElement>("#save-config");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      const updated = await putConfig(readConfigForm());
      populateConfigForm(updated);
      flash($("#save-flash"), "Saved");
      await refreshStatusAndEvents();
    } catch (err) {
      configError.hidden = false;
      configError.textContent = err instanceof Error ? err.message : String(err);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
  })();
});

$("#refresh-events").addEventListener("click", () => void refreshStatusAndEvents());

eventsContainer.addEventListener("click", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return;
  const btn = target.closest<HTMLButtonElement>(".reveal-btn");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (!Number.isFinite(id)) return;
  void toggleReveal(id);
});

$("#preview-btn").addEventListener("click", () => {
  void (async () => {
    const text = $<HTMLTextAreaElement>("#preview-input").value;
    if (!text.trim()) return;
    const lang = $<HTMLSelectElement>("#preview-language").value;
    const previewBtn = $<HTMLButtonElement>("#preview-btn");
    previewBtn.disabled = true;
    previewBtn.textContent = "Working…";
    try {
      const language = lang === "auto" || lang === "ja" || lang === "en" ? lang : "auto";
      const result = await postPreview({ text, language });
      previewOutput.innerHTML = renderWithHighlights(
        result.anonymized,
        Object.keys(result.mapping),
        "pii-label",
      );
      const tbody = previewMapping.querySelector("tbody")!;
      tbody.innerHTML = Object.entries(result.mapping)
        .map(
          ([label, original]) =>
            `<tr><td class="label-cell">${escapeHtml(label)}</td><td>${escapeHtml(original)}</td></tr>`,
        )
        .join("");
      previewMapping.hidden = Object.keys(result.mapping).length === 0;
    } catch (err) {
      previewOutput.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
      previewMapping.hidden = true;
    } finally {
      previewBtn.disabled = false;
      previewBtn.textContent = "Preview anonymization";
    }
  })();
});

$("#load-sample").addEventListener("click", () => {
  const value = $<HTMLSelectElement>("#preview-language").value;
  const language =
    value === "auto" ? (navigator.language?.startsWith("ja") ? "ja" : "en") : value;
  $<HTMLTextAreaElement>("#preview-input").value =
    language === "ja" ? SAMPLES.ja : SAMPLES.en;
});

// --- Startup ---

void loadInitialConfig();
void refreshStatusAndEvents();
setInterval(() => void refreshStatusAndEvents(), 3000);
