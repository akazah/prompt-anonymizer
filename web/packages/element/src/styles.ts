/*
 * Self-contained styles for the published <prompt-anonymizer> element.
 * Dark by default to match the prompt-anonymizer brand; every color is
 * exposed as a --pa-* custom property so host pages can re-theme without
 * forking. Keep the default values in sync with
 * packages/theme/tokens.css (this package must stay dependency-free).
 */
export const PANEL_STYLES = `
:host {
  display: block;
  font-family: -apple-system, "Segoe UI", "Hiragino Sans", "Yu Gothic UI",
    "Noto Sans JP", system-ui, sans-serif;
  line-height: 1.6;

  --pa-bg: #10121a;
  --pa-bg-input: #0b0d13;
  --pa-border: rgba(255, 255, 255, 0.08);
  --pa-border-strong: rgba(255, 255, 255, 0.14);
  --pa-text: #eceef4;
  --pa-text-dim: #9aa1b2;
  --pa-text-faint: #646b7c;
  --pa-accent: #8b7cf8;
  --pa-accent-hover: #9d90fa;
  --pa-ok: #34d399;
  --pa-warn: #f0b34e;
  --pa-warn-bg: rgba(240, 179, 78, 0.12);
  --pa-gradient-btn: linear-gradient(180deg, #8b7cf8, #6d5ef5);
  --pa-focus-ring: 0 0 0 3px rgba(139, 124, 248, 0.35);
  --pa-radius: 12px;
  --pa-radius-sm: 8px;
  --pa-font-mono: ui-monospace, "SF Mono", "Cascadia Code", monospace;
}

.panel {
  background: var(--pa-bg);
  color: var(--pa-text);
  border: 1px solid var(--pa-border);
  border-radius: var(--pa-radius);
  padding: 16px 18px;
  box-shadow: 0 0 0 1px var(--pa-border), 0 8px 24px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.ner-warning {
  color: var(--pa-warn);
  background: var(--pa-warn-bg);
  border: 1px solid rgba(240, 179, 78, 0.3);
  padding: 8px 12px;
  border-radius: var(--pa-radius-sm);
  font-size: 13px;
  margin: 0 0 12px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}

.toolbar label {
  font-size: 13px;
  color: var(--pa-text-dim);
  display: flex;
  align-items: center;
  gap: 6px;
}

select,
button {
  background: var(--pa-bg);
  color: var(--pa-text);
  border: 1px solid var(--pa-border-strong);
  border-radius: var(--pa-radius-sm);
  padding: 7px 14px;
  font-size: 13.5px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease,
    box-shadow 0.15s ease, transform 0.1s ease;
}

button:hover:not(:disabled) {
  background: #141724;
}

button:active:not(:disabled) {
  transform: scale(0.98);
}

button:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: none;
  box-shadow: var(--pa-focus-ring);
}

button.anonymize,
button.restore {
  background: var(--pa-gradient-btn);
  color: #fff;
  border-color: transparent;
  font-weight: 600;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

button.anonymize:hover:not(:disabled),
button.restore:hover:not(:disabled) {
  background: linear-gradient(180deg, var(--pa-accent-hover), #7a6cf7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 0 24px rgba(109, 94, 245, 0.28);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

textarea {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  background: var(--pa-bg-input);
  color: var(--pa-text);
  border: 1px solid var(--pa-border);
  border-radius: var(--pa-radius-sm);
  padding: 12px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
  margin-bottom: 8px;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

textarea:focus {
  outline: none;
  border-color: var(--pa-accent);
}

textarea::placeholder {
  color: var(--pa-text-faint);
}

.output,
.restore-output {
  min-height: 80px;
  background: var(--pa-bg-input);
  border: 1px solid var(--pa-border);
  border-radius: var(--pa-radius-sm);
  padding: 12px;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 8px 0;
  box-sizing: border-box;
}

table.mapping {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-top: 10px;
}

table.mapping th,
table.mapping td {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--pa-border);
}

table.mapping th {
  color: var(--pa-text-faint);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

table.mapping td.label-cell {
  font-family: var(--pa-font-mono);
  font-weight: 600;
  white-space: nowrap;
  color: var(--pa-accent-hover);
}

button.copy {
  margin-bottom: 8px;
}

section.restore {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--pa-border);
}

.unresolved-warning {
  color: var(--pa-warn);
  background: var(--pa-warn-bg);
  border: 1px solid rgba(240, 179, 78, 0.3);
  padding: 8px 12px;
  border-radius: var(--pa-radius-sm);
  font-size: 13px;
  margin: 8px 0 0;
}

.hint {
  font-size: 12.5px;
  color: var(--pa-text-dim);
  margin: 12px 0 0;
}

[hidden] {
  display: none !important;
}
`;
