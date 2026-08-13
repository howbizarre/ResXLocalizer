/**
 * @module webview/renderTable
 * Builds the self-contained HTML/CSS/JS for the main translation-table webview — the pure
 * "view" half of {@link ../panels/tablePanel}, which owns the actual `WebviewPanel` and reacts
 * to the `postMessage` events this markup sends (save/delete/addKey/export/import).
 * No `vscode` API is used here; everything runs inside the sandboxed webview instead.
 */
import { ResxGroup } from "../resx/resxParser";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function columnLabel(locale: string | null): string {
  return locale ? locale : "default";
}

function renderGroup(group: ResxGroup): string {
  const locales = group.files.map((f) => f.locale);
  const allKeys = new Set<string>();
  for (const file of group.files) {
    for (const key of file.entries.keys()) {
      allKeys.add(key);
    }
  }
  const sortedKeys = Array.from(allKeys).sort((a, b) => a.localeCompare(b));

  const headerCells = locales
    .map(
      (locale, i) =>
        `<th><div class="col-header"><span class="col-label">${escapeHtml(columnLabel(locale))}</span><input type="text" class="col-filter" data-col="${i + 1}" placeholder="Filter" /></div></th>`
    )
    .join("");

  const addRowValueCells = group.files
    .map((file) => `<td class="value-cell" data-file="${escapeHtml(file.uri.fsPath)}"></td>`)
    .join("");
  const addRow = `<tr class="add-row"><td class="action-col"><button class="icon-btn add-toggle" data-editing="false" title="Edit row"><span class="icon-slot"></span></button></td><td class="key add-key" data-placeholder="New key"></td>${addRowValueCells}</tr>`;

  const rows = sortedKeys
    .map((key) => {
      const cells = group.files
        .map((file, i) => {
          const entry = file.entries.get(key);
          const cls = entry && entry.value.trim() !== "" ? "value-cell" : "value-cell missing";
          const filePath = escapeHtml(file.uri.fsPath);
          return `<td class="${cls}" data-col="${i + 1}" data-file="${filePath}" data-key="${escapeHtml(key)}">${escapeHtml(entry?.value ?? "")}</td>`;
        })
        .join("");
      return `<tr data-key="${escapeHtml(key)}"><td class="action-col"><button class="icon-btn icon-btn-edit row-edit-toggle" data-editing="false" title="Edit row"><span class="icon-slot"></span></button><button class="icon-btn icon-btn-delete row-delete" title="Delete row"><span class="icon-slot"></span></button></td><td class="key" data-col="0">${escapeHtml(key)}</td>${cells}</tr>`;
    })
    .join("\n");

  return `
  <div class="group-header">
    <div class="group-title">
      <h2>${escapeHtml(group.baseName)}</h2>
      <span class="group-meta">${sortedKeys.length} keys &middot; ${locales.length} locales</span>
    </div>
    <div class="group-actions">
      <button class="pill-btn import-btn" title="Import translations from a CSV or JSON file"><span class="icon-slot"></span><span>Import</span></button>
      <button class="pill-btn export-btn" title="Export table to CSV or JSON"><span class="icon-slot"></span><span>Export</span></button>
    </div>
  </div>
  <div class="table-wrapper">
  <table>
    <thead><tr><th class="action-col">Actions</th><th><div class="col-header"><span class="col-label">Key</span><input type="text" class="col-filter" data-col="0" placeholder="Filter…" /></div></th>${headerCells}</tr></thead>
    <tbody>${addRow}\n${rows}</tbody>
  </table>
  </div>`;
}

/**
 * Renders the full HTML document for a table webview panel — one `<section>`-like block
 * per group (in practice {@link ../panels/tablePanel} always passes exactly one).
 */
export function renderTableHtml(groups: ResxGroup[]): string {
  if (groups.length === 0) {
    return `<!DOCTYPE html><html><body style="font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 8px;"><p>No .resx files found in this workspace.</p></body></html>`;
  }

  const nonce = getNonce();
  const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;

  const sections = groups.map((group) => renderGroup(group)).join("\n<hr/>\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 4px 20px 40px;
      font-size: 14px;
    }
    .group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 28px;
      margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .group-title {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }
    h2 {
      font-weight: 650;
      margin: 0;
      font-size: 17px;
      letter-spacing: 0.1px;
    }
    .group-meta {
      font-size: 12px;
      opacity: 0.6;
    }
    .group-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    .pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px 6px 10px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--vscode-charts-blue, var(--vscode-focusBorder)) 40%, transparent);
      background: color-mix(in srgb, var(--vscode-charts-blue, var(--vscode-focusBorder)) 10%, transparent);
      color: var(--vscode-charts-blue, var(--vscode-textLink-foreground));
      font-family: var(--vscode-font-family);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.12s ease, border-color 0.12s ease, transform 0.06s ease;
    }
    .pill-btn:hover {
      background: color-mix(in srgb, var(--vscode-charts-blue, var(--vscode-focusBorder)) 20%, transparent);
    }
    .pill-btn:active {
      transform: scale(0.96);
    }
    .pill-btn .icon-slot svg {
      width: 15px;
      height: 15px;
      pointer-events: none;
    }
    .import-btn {
      border-color: color-mix(in srgb, var(--vscode-charts-green, #3fb950) 40%, transparent);
      background: color-mix(in srgb, var(--vscode-charts-green, #3fb950) 10%, transparent);
      color: var(--vscode-charts-green, #3fb950);
    }
    .import-btn:hover {
      background: color-mix(in srgb, var(--vscode-charts-green, #3fb950) 20%, transparent);
    }
    .table-wrapper {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 13.5px;
    }
    th, td {
      padding: 12px 14px;
      text-align: left;
      vertical-align: middle;
      word-break: break-word;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    th {
      background: var(--vscode-editorGroupHeader-tabsBackground);
      position: sticky;
      top: 0;
      z-index: 1;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.75;
      padding-top: 10px;
      padding-bottom: 10px;
    }
    tbody tr[data-key]:hover {
      background: color-mix(in srgb, var(--vscode-list-hoverBackground, var(--vscode-editor-selectionBackground)) 60%, transparent);
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    .col-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .col-label {
      flex-shrink: 0;
      white-space: nowrap;
    }
    .col-filter {
      flex: 1 1 auto;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
      font-size: 12px;
      font-weight: normal;
      text-transform: none;
      letter-spacing: normal;
      padding: 6px 10px;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 999px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
    }
    .col-filter:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }
    .col-filter::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    td.key {
      font-family: var(--vscode-editor-font-family, monospace);
      font-weight: 600;
    }
    td.missing {
      color: var(--vscode-errorForeground, #f14c4c);
      background: color-mix(in srgb, var(--vscode-errorForeground, #f14c4c) 10%, transparent);
      box-shadow: inset 3px 0 0 var(--vscode-errorForeground, #f14c4c);
    }
    tr.add-row {
      background: color-mix(in srgb, var(--vscode-charts-blue, var(--vscode-focusBorder)) 8%, transparent);
    }
    tr.add-row td.value-cell,
    tr.add-row td.key {
      cursor: text;
    }
    .add-key:empty:before {
      content: attr(data-placeholder);
      opacity: 0.55;
      pointer-events: none;
    }
    .add-key.invalid {
      outline: 1px solid var(--vscode-inputValidation-errorBorder, #f14c4c);
      background: var(--vscode-inputValidation-errorBackground, rgba(244, 135, 113, 0.15));
    }
    .action-col {
      width: 88px;
      white-space: nowrap;
      text-align: center;
      padding: 8px 6px;
    }
    .icon-btn {
      border: 1px solid transparent;
      background: transparent;
      color: var(--vscode-foreground);
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      transition: background-color 0.12s ease, border-color 0.12s ease, transform 0.06s ease;
    }
    .icon-btn:active {
      transform: scale(0.92);
    }
    .icon-btn-edit,
    .add-toggle {
      color: var(--vscode-charts-blue, var(--vscode-textLink-foreground));
    }
    .icon-btn-edit:hover,
    .add-toggle:hover {
      background: color-mix(in srgb, var(--vscode-charts-blue, var(--vscode-textLink-foreground)) 16%, transparent);
      border-color: color-mix(in srgb, var(--vscode-charts-blue, var(--vscode-textLink-foreground)) 35%, transparent);
    }
    .icon-btn-edit[data-editing="true"],
    .add-toggle[data-editing="true"] {
      color: var(--vscode-charts-green, #3fb950);
      background: color-mix(in srgb, var(--vscode-charts-green, #3fb950) 16%, transparent);
      border-color: color-mix(in srgb, var(--vscode-charts-green, #3fb950) 35%, transparent);
    }
    .icon-btn-delete {
      color: var(--vscode-errorForeground, #f14c4c);
    }
    .icon-btn-delete:hover {
      background: color-mix(in srgb, var(--vscode-errorForeground, #f14c4c) 16%, transparent);
      border-color: color-mix(in srgb, var(--vscode-errorForeground, #f14c4c) 35%, transparent);
    }
    .icon-btn svg {
      width: 17px;
      height: 17px;
      pointer-events: none;
    }
    tr.editing td.value-cell {
      cursor: text;
    }
    td.value-cell[contenteditable="true"]:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <template id="icon-edit"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M12.146 1.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1 0 .708l-8.5 8.5a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l8.5-8.5zM11.5 2.5 13.5 4.5 14.646 3.354 12.646 1.354 11.5 2.5zM10.793 3.207 4 10v.001L3.293 12.708 6 12l6.793-6.793-2-2z"/></svg></template>
  <template id="icon-save"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 1h9.5a.5.5 0 0 1 .354.146l2 2A.5.5 0 0 1 14 3.5V14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm1 1v3h7V2H3zm-1 5v7h10V8H2zm2 1h6v3H4V9z"/></svg></template>
  <template id="icon-delete"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M6 2a1 1 0 0 0-1 1v1H2.5a.5.5 0 0 0 0 1H3v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5h.5a.5.5 0 0 0 0-1H11V3a1 1 0 0 0-1-1H6zm0 1h4v1H6V3zM4 5h8v9H4V5zm2 2a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5A.5.5 0 0 0 6 7zm2 0a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5A.5.5 0 0 0 8 7zm2 0a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5A.5.5 0 0 0 10 7z"/></svg></template>
  <template id="icon-export"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 0 1 .5.5v7.293l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 8.793V1.5A.5.5 0 0 1 8 1zM2.5 13a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/></svg></template>
  <template id="icon-import"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 15a.5.5 0 0 1-.5-.5V7.207L5.354 9.354a.5.5 0 1 1-.708-.708l3-3a.5.5 0 0 1 .708 0l3 3a.5.5 0 1 1-.708.708L8.5 7.207V14.5A.5.5 0 0 1 8 15zM2.5 3a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/></svg></template>
  ${sections}
  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();

      function setIcon(button, templateId) {
        const template = document.getElementById(templateId);
        const slot = button.querySelector(".icon-slot");
        slot.innerHTML = "";
        slot.appendChild(template.content.cloneNode(true));
      }

      document.querySelectorAll("tr[data-key]").forEach((row) => {
        const editBtn = row.querySelector(".row-edit-toggle");
        const deleteBtn = row.querySelector(".row-delete");
        if (!editBtn || !deleteBtn) return;

        setIcon(editBtn, "icon-edit");
        setIcon(deleteBtn, "icon-delete");

        editBtn.addEventListener("click", () => {
          const cells = Array.from(row.querySelectorAll("td.value-cell"));
          const editing = editBtn.dataset.editing === "true";

          if (!editing) {
            cells.forEach((c) => { c.contentEditable = "true"; });
            row.classList.add("editing");
            editBtn.dataset.editing = "true";
            editBtn.title = "Save row";
            setIcon(editBtn, "icon-save");
            if (cells.length) cells[0].focus();
          } else {
            const edits = cells.map((c) => ({
              file: c.dataset.file,
              key: c.dataset.key,
              value: c.textContent || ""
            }));
            vscode.postMessage({ command: "save", edits });
          }
        });

        deleteBtn.addEventListener("click", () => {
          const cells = Array.from(row.querySelectorAll("td.value-cell"));
          const files = cells.map((c) => c.dataset.file);
          vscode.postMessage({ command: "delete", key: row.dataset.key, files });
        });
      });

      document.querySelectorAll("tr.add-row").forEach((row) => {
        const toggleBtn = row.querySelector(".add-toggle");
        const keyCell = row.querySelector(".add-key");
        if (!toggleBtn || !keyCell) return;

        setIcon(toggleBtn, "icon-edit");
        keyCell.addEventListener("input", () => keyCell.classList.remove("invalid"));

        toggleBtn.addEventListener("click", () => {
          const cells = Array.from(row.querySelectorAll("td.value-cell"));
          const editing = toggleBtn.dataset.editing === "true";

          if (!editing) {
            keyCell.contentEditable = "true";
            cells.forEach((c) => { c.contentEditable = "true"; });
            row.classList.add("editing");
            toggleBtn.dataset.editing = "true";
            toggleBtn.title = "Save row";
            setIcon(toggleBtn, "icon-save");
            keyCell.focus();
          } else {
            const key = (keyCell.textContent || "").trim();
            if (!key) {
              keyCell.classList.add("invalid");
              keyCell.focus();
              return;
            }
            const edits = cells.map((c) => ({
              file: c.dataset.file,
              key,
              value: c.textContent || ""
            }));
            vscode.postMessage({ command: "addKey", key, edits });
          }
        });
      });

      document.querySelectorAll(".export-btn").forEach((btn) => {
        setIcon(btn, "icon-import");
        btn.addEventListener("click", () => {
          vscode.postMessage({ command: "export" });
        });
      });

      document.querySelectorAll(".import-btn").forEach((btn) => {
        setIcon(btn, "icon-export");
        btn.addEventListener("click", () => {
          vscode.postMessage({ command: "import" });
        });
      });

      function applyFilters(table) {
        const filters = Array.from(table.querySelectorAll(".col-filter"))
          .map((input) => ({ col: input.dataset.col, value: input.value.trim().toLowerCase() }))
          .filter((f) => f.value.length > 0);

        table.querySelectorAll("tbody tr[data-key]").forEach((row) => {
          const visible = filters.every((f) => {
            const cell = row.querySelector('td[data-col="' + f.col + '"]');
            const text = (cell ? cell.textContent : "") || "";
            return text.toLowerCase().indexOf(f.value) !== -1;
          });
          row.style.display = visible ? "" : "none";
        });
      }

      document.querySelectorAll(".col-filter").forEach((input) => {
        input.addEventListener("input", () => {
          const table = input.closest("table");
          if (table) applyFilters(table);
        });
      });
    })();
  </script>
</body>
</html>`;
}
