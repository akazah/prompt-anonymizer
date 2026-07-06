export const PANEL_STYLES = `
:host {
  display: block;
  font-family: system-ui, sans-serif;
  line-height: 1.6;
}

.panel {
  border: 1px solid #d8dee9;
  border-radius: 10px;
  padding: 14px 16px;
}

.ner-warning {
  color: #b45309;
  background: #fef3c7;
  padding: 8px 12px;
  border-radius: 6px;
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
  display: flex;
  align-items: center;
  gap: 6px;
}

select,
button {
  border: 1px solid #d8dee9;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 13.5px;
  cursor: pointer;
  background: #fff;
}

button.anonymize,
button.restore {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
  font-weight: 600;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

textarea {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
  margin-bottom: 8px;
  box-sizing: border-box;
}

.output,
.restore-output {
  min-height: 80px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
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
  border-bottom: 1px solid #d8dee9;
}

table.mapping th {
  color: #6b7280;
  font-weight: 500;
}

table.mapping td.label-cell {
  font-family: ui-monospace, monospace;
  font-weight: 600;
  white-space: nowrap;
}

button.copy {
  margin-bottom: 8px;
}

section.restore {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #d8dee9;
}

.unresolved-warning {
  color: #b45309;
  background: #fef3c7;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  margin: 8px 0 0;
}

.hint {
  font-size: 12.5px;
  color: #6b7280;
  margin: 12px 0 0;
}

[hidden] {
  display: none !important;
}
`;
