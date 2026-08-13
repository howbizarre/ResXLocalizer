import * as vscode from "vscode";
import { ImportLogEntry } from "./exportImport";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderLogHtml(groupName: string, log: ImportLogEntry[], ignoredColumns: string[], warnings: string[]): string {
  const added = log.filter((e) => e.action === "added");
  const overwritten = log.filter((e) => e.action === "overwritten");

  const rows = overwritten
    .map(
      (e) => `<tr>
        <td class="key">${escapeHtml(e.key)}</td>
        <td>${escapeHtml(e.column)}</td>
        <td class="old-value">${escapeHtml(e.oldValue ?? "")}</td>
        <td class="new-value">${escapeHtml(e.newValue)}</td>
      </tr>`
    )
    .join("\n");

  const warningsHtml = warnings.length
    ? `<div class="note note-warning"><strong>${warnings.length} warning(s):</strong><ul>${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>`
    : "";

  const ignoredHtml = ignoredColumns.length
    ? `<div class="note">Columns ignored (no matching language file in this table): ${ignoredColumns.map((c) => `<code>${escapeHtml(c)}</code>`).join(", ")}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 20px 24px 40px;
      font-size: 14px;
    }
    h1 {
      font-size: 18px;
      margin: 0 0 4px;
    }
    .summary {
      opacity: 0.75;
      margin: 0 0 20px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 8px;
    }
    .badge-added {
      color: var(--vscode-charts-green, #3fb950);
      background: color-mix(in srgb, var(--vscode-charts-green, #3fb950) 16%, transparent);
    }
    .badge-overwritten {
      color: var(--vscode-charts-orange, #d18616);
      background: color-mix(in srgb, var(--vscode-charts-orange, #d18616) 16%, transparent);
    }
    .note {
      font-size: 12.5px;
      opacity: 0.85;
      background: var(--vscode-editorGroupHeader-tabsBackground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }
    .note-warning {
      border-color: color-mix(in srgb, var(--vscode-charts-orange, #d18616) 40%, var(--vscode-panel-border));
    }
    .note ul {
      margin: 6px 0 0;
      padding-left: 18px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 13px;
    }
    th, td {
      padding: 8px 12px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    th {
      background: var(--vscode-editorGroupHeader-tabsBackground);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.75;
    }
    td.key {
      font-family: var(--vscode-editor-font-family, monospace);
      font-weight: 600;
      white-space: nowrap;
    }
    td.old-value {
      color: var(--vscode-errorForeground, #f14c4c);
      text-decoration: line-through;
      opacity: 0.8;
    }
    td.new-value {
      color: var(--vscode-charts-green, #3fb950);
    }
  </style>
</head>
<body>
  <h1>Import log — ${escapeHtml(groupName)}</h1>
  <p class="summary">
    <span class="badge badge-added">${added.length} added</span>
    <span class="badge badge-overwritten">${overwritten.length} overwritten</span>
  </p>
  ${warningsHtml}
  ${ignoredHtml}
  ${
    overwritten.length
      ? `<table>
    <thead><tr><th>Key</th><th>Column</th><th>Old value</th><th>New value</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
      : "<p>No existing values were overwritten.</p>"
  }
</body>
</html>`;
}

/** Opens a read-only tab summarizing an import, listing every pre-existing key that got overwritten. */
export function showImportLog(groupName: string, log: ImportLogEntry[], ignoredColumns: string[], warnings: string[]): void {
  const panel = vscode.window.createWebviewPanel(
    "resxlocalizerImportLog",
    `Import Log: ${groupName}`,
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );
  panel.webview.html = renderLogHtml(groupName, log, ignoredColumns, warnings);
}
