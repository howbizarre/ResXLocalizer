import { ResxGroup } from "./resxParser";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  const headerCells = locales.map((locale) => `<th>${escapeHtml(columnLabel(locale))}</th>`).join("");

  const rows = sortedKeys
    .map((key) => {
      const cells = group.files
        .map((file) => {
          const entry = file.entries.get(key);
          const cls = entry ? "" : " class=\"missing\"";
          return `<td${cls}>${escapeHtml(entry?.value ?? "")}</td>`;
        })
        .join("");
      return `<tr><td class="key">${escapeHtml(key)}</td>${cells}</tr>`;
    })
    .join("\n");

  return `
  <h2>${escapeHtml(group.baseName)}</h2>
  <table>
    <thead><tr><th>Key</th>${headerCells}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function renderTableHtml(groups: ResxGroup[]): string {
  if (groups.length === 0) {
    return `<!DOCTYPE html><html><body style="font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 8px;"><p>No .resx files found in this workspace.</p></body></html>`;
  }

  const sections = groups.map((group) => renderGroup(group)).join("\n<hr/>\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 0 12px 32px;
    }
    h2 {
      font-weight: 600;
      margin-top: 24px;
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
    td.key {
      font-family: var(--vscode-editor-font-family, monospace);
    }
    td.missing {
      background: var(--vscode-inputValidation-warningBackground);
    }
  </style>
</head>
<body>
  ${sections}
</body>
</html>`;
}
