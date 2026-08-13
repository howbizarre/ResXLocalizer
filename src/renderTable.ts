import { ResxGroup } from "./resxParser";

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
  const addRow = `<tr class="add-row"><td class="action-col"><button class="add-toggle" data-editing="false" title="Edit row"><span class="icon-slot"></span></button></td><td class="key add-key" data-placeholder="New key"></td>${addRowValueCells}</tr>`;

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
      return `<tr data-key="${escapeHtml(key)}"><td class="action-col"><button class="row-edit-toggle" data-editing="false" title="Edit row"><span class="icon-slot"></span></button><button class="row-delete" title="Delete row"><span class="icon-slot"></span></button></td><td class="key" data-col="0">${escapeHtml(key)}</td>${cells}</tr>`;
    })
    .join("\n");

  return `
  <h2>${escapeHtml(group.baseName)}</h2>
  <table>
    <thead><tr><th class="action-col">Actions</th><th><div class="col-header"><span class="col-label">Key</span><input type="text" class="col-filter" data-col="0" placeholder="Filter" /></div></th>${headerCells}</tr></thead>
    <tbody>${addRow}\n${rows}</tbody>
  </table>`;
}

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
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 0 12px 32px;
    }
    h2 {
      font-weight: 600;
      margin-top: 24px;
      margin-bottom: 6px;
      font-size: 13px;
      text-transform: uppercase;
      opacity: 0.8;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 12px;
    }
    th, td {
      border: 1px solid var(--vscode-panel-border);
      padding: 4px 6px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }
    th {
      background: var(--vscode-editorGroupHeader-tabsBackground);
      position: sticky;
      top: 0;
    }
    .col-header {
      display: flex;
      align-items: center;
      gap: 4px;
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
      font-size: 11px;
      font-weight: normal;
      text-transform: none;
      padding: 2px 4px;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 2px;
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
    }
    td.missing {
      color: var(--vscode-errorForeground, #f14c4c);
      background: var(--vscode-inputValidation-errorBackground, rgba(244, 135, 113, 0.15));
      border-color: var(--vscode-inputValidation-errorBorder, #f14c4c);
    }
    tr.add-row {
      background: var(--vscode-editor-inactiveSelectionBackground, transparent);
    }
    tr.add-row td.value-cell,
    tr.add-row td.key {
      cursor: text;
    }
    .add-key:empty:before {
      content: attr(data-placeholder);
      opacity: 0.5;
      pointer-events: none;
    }
    .add-key.invalid {
      outline: 1px solid var(--vscode-inputValidation-errorBorder, #f14c4c);
      background: var(--vscode-inputValidation-errorBackground, rgba(244, 135, 113, 0.15));
    }
    .action-col {
      width: 54px;
      white-space: nowrap;
      text-align: center;
      padding: 2px 4px;
    }
    .add-toggle,
    .row-edit-toggle,
    .row-delete {
      border: none;
      background: transparent;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 3px;
      border-radius: 3px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .add-toggle:hover,
    .row-edit-toggle:hover,
    .row-delete:hover {
      background: var(--vscode-toolbar-hoverBackground);
    }
    .row-delete:hover {
      color: var(--vscode-errorForeground, #f14c4c);
    }
    .add-toggle svg,
    .row-edit-toggle svg,
    .row-delete svg {
      width: 13px;
      height: 13px;
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
    }
  </style>
</head>
<body>
  <template id="icon-edit"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M12.146 1.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1 0 .708l-8.5 8.5a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l8.5-8.5zM11.5 2.5 13.5 4.5 14.646 3.354 12.646 1.354 11.5 2.5zM10.793 3.207 4 10v.001L3.293 12.708 6 12l6.793-6.793-2-2z"/></svg></template>
  <template id="icon-save"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 1h9.5a.5.5 0 0 1 .354.146l2 2A.5.5 0 0 1 14 3.5V14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zm1 1v3h7V2H3zm-1 5v7h10V8H2zm2 1h6v3H4V9z"/></svg></template>
  <template id="icon-delete"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M6 2a1 1 0 0 0-1 1v1H2.5a.5.5 0 0 0 0 1H3v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5h.5a.5.5 0 0 0 0-1H11V3a1 1 0 0 0-1-1H6zm0 1h4v1H6V3zM4 5h8v9H4V5zm2 2a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5A.5.5 0 0 0 6 7zm2 0a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5A.5.5 0 0 0 8 7zm2 0a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5A.5.5 0 0 0 10 7z"/></svg></template>
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
