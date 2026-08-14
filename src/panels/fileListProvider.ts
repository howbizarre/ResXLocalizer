/**
 * @module panels/fileListProvider
 * Owns the sidebar's `WebviewView` (the Activity Bar tree of `.resx` files). Builds its own
 * HTML inline (unlike {@link ../panels/tablePanel}, which delegates to a separate render
 * module) since the tree is small and specific to this one view. Handles checkbox selection
 * (opens a table via the callback passed to its constructor), "Add new" locale, and the
 * always-visible "Create master .resx file" action at the top of the panel.
 */
import * as vscode from "vscode";
import { findResxFiles, parseResxFile, parseResxFileName } from "../resx/resxParser";
import { detectNeutralLanguage, normalizeToTwoLetters } from "../locale/neutralLanguage";
import { pickLocale } from "../locale/locales";
import { buildEmptyResxContent } from "../resx/resxTemplate";
import { applyFamilyConvention } from "../locale/localeConvention";
import { createMasterResxFile } from "../resx/createMaster";

const UNKNOWN_MASTER_LABEL = "src";

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

interface FileItem {
  uri: vscode.Uri;
  fileName: string;
  label: string;
  locale: string | null;
  isMaster: boolean;
}

interface FamilyGroup {
  baseName: string;
  dirUri: vscode.Uri;
  items: FileItem[];
}

export class FileListProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "resxlocalizer.fileListView";

  private view: vscode.WebviewView | undefined;

  /** @param onOpenTable Called with the checked file URIs whenever the user should see them in a table. */
  constructor(private readonly onOpenTable: (uris: vscode.Uri[]) => void) {}

  /** VS Code calls this once when the sidebar view is first shown; wires messages and does the initial render. */
  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message?.command === "openTable" && Array.isArray(message.paths)) {
        const uris = (message.paths as string[]).map((p) => vscode.Uri.file(p));
        if (uris.length > 0) {
          this.onOpenTable(uris);
        }
      } else if (message?.command === "addLocale") {
        void this.handleAddLocale(
          String(message.dir ?? ""),
          String(message.baseName ?? ""),
          message.masterPath ? String(message.masterPath) : null,
          Array.isArray(message.existing) ? (message.existing as string[]) : []
        );
      } else if (message?.command === "createMaster") {
        void this.handleCreateMaster();
      }
    });
    void this.refresh();
  }

  /** Re-scans the workspace for `.resx` files and re-renders the tree. */
  public async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    const [uris, neutralLanguage] = await Promise.all([findResxFiles(), detectNeutralLanguage()]);
    this.view.webview.html = this.renderHtml(uris, neutralLanguage);
  }

  /** Clears the checkbox for the given file paths — called when their table tab gets closed. */
  public uncheckFiles(paths: string[]): void {
    if (paths.length === 0) {
      return;
    }
    void this.view?.webview.postMessage({ command: "uncheckFiles", paths });
  }

  private async handleAddLocale(
    dirFsPath: string,
    baseName: string,
    masterPath: string | null,
    existingLocales: string[]
  ): Promise<void> {
    if (!dirFsPath || !baseName) {
      return;
    }

    const exclude = new Set(existingLocales.map((l) => l.toLowerCase()));
    const pickedLocale = await pickLocale(exclude);
    if (!pickedLocale) {
      return;
    }
    const locale = applyFamilyConvention(pickedLocale, existingLocales);

    const dirUri = vscode.Uri.file(dirFsPath);
    const newFileUri = vscode.Uri.joinPath(dirUri, `${baseName}.${locale}.resx`);

    try {
      await vscode.workspace.fs.stat(newFileUri);
      vscode.window.showWarningMessage(`ResXLocalizer: ${baseName}.${locale}.resx already exists.`);
      return;
    } catch {
      // File does not exist yet — safe to create.
    }

    let keys: string[] = [];
    if (masterPath) {
      try {
        const master = await parseResxFile(vscode.Uri.file(masterPath));
        keys = Array.from(master.entries.keys());
      } catch {
        keys = [];
      }
    }

    const content = buildEmptyResxContent(keys);
    await vscode.workspace.fs.writeFile(newFileUri, Buffer.from(content, "utf8"));

    const doc = await vscode.workspace.openTextDocument(newFileUri);
    await vscode.window.showTextDocument(doc, { preview: false });

    await this.refresh();
  }

  private async handleCreateMaster(): Promise<void> {
    await createMasterResxFile();
    await this.refresh();
  }

  private buildTree(
    uris: vscode.Uri[],
    neutralLanguage: string | null
  ): Map<string, Map<string, FamilyGroup>> {
    const multiRoot = (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
    const tree = new Map<string, Map<string, FamilyGroup>>();

    for (const uri of uris) {
      const rel = vscode.workspace.asRelativePath(uri, multiRoot).replace(/\\/g, "/");
      const slashIdx = rel.lastIndexOf("/");
      const folder = slashIdx === -1 ? "" : rel.slice(0, slashIdx);
      const fileName = slashIdx === -1 ? rel : rel.slice(slashIdx + 1);
      const { baseName, locale } = parseResxFileName(fileName);

      const isMaster = locale === null;
      const label = isMaster ? neutralLanguage ?? UNKNOWN_MASTER_LABEL : normalizeToTwoLetters(locale);

      const families = tree.get(folder) ?? new Map<string, FamilyGroup>();
      tree.set(folder, families);

      const family = families.get(baseName) ?? {
        baseName,
        dirUri: vscode.Uri.joinPath(uri, ".."),
        items: []
      };
      family.items.push({ uri, fileName, label, locale, isMaster });
      families.set(baseName, family);
    }

    for (const families of tree.values()) {
      for (const family of families.values()) {
        family.items.sort((a, b) => {
          if (a.isMaster !== b.isMaster) {
            return a.isMaster ? -1 : 1;
          }
          return a.label.localeCompare(b.label);
        });
      }
    }

    return tree;
  }

  private renderHtml(uris: vscode.Uri[], neutralLanguage: string | null): string {
    const nonce = getNonce();
    const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;

    const tree = this.buildTree(uris, neutralLanguage);
    const sortedFolders = Array.from(tree.keys()).sort((a, b) => a.localeCompare(b));

    const groupsHtml = sortedFolders
      .map((folder) => {
        const families = tree.get(folder)!;
        const sortedBaseNames = Array.from(families.keys()).sort((a, b) => a.localeCompare(b));

        const familiesHtml = sortedBaseNames
          .map((baseName) => {
            const family = families.get(baseName)!;
            const master = family.items.find((i) => i.isMaster);
            const existing = family.items
              .filter((i) => !i.isMaster && i.locale)
              .map((i) => escapeHtml(i.locale!))
              .join(",");

            const itemsHtml = family.items
              .map((item) => {
                const path = escapeHtml(item.uri.fsPath);
                const name = escapeHtml(item.fileName);
                const badgeClass = item.isMaster ? "locale-badge master" : "locale-badge";
                const title = item.isMaster ? ' title="Master file"' : "";
                return `<label class="item"><input type="checkbox" class="file-checkbox" data-path="${path}" data-group="${escapeHtml(folder + "::" + baseName)}" data-master="${item.isMaster}" /><span class="${badgeClass}"${title}>${escapeHtml(item.label)}</span><span class="name">${name}</span></label>`;
              })
              .join("\n");

            const addNewHtml = `<div class="add-new" data-dir="${escapeHtml(family.dirUri.fsPath)}" data-base="${escapeHtml(baseName)}" data-master-path="${master ? escapeHtml(master.uri.fsPath) : ""}" data-existing="${existing}"><span class="plus-icon">+</span><span>Add new</span></div>`;

            return `<div class="family"><div class="family-header">${escapeHtml(baseName)}</div>${itemsHtml}\n${addNewHtml}</div>`;
          })
          .join("\n");

        const folderLabel = escapeHtml(folder || "(root)");
        return `<details class="group" open><summary><span class="folder-icon">📁</span>${folderLabel}</summary><div class="group-items">${familiesHtml}</div></details>`;
      })
      .join("\n");

    const createMasterAction = `<button id="createMasterBtn" class="create-master-btn" title="Create a new master .resx file"><span class="plus-icon">+</span><span>Create master .resx file</span></button>`;

    const treeOrEmptyState =
      uris.length === 0
        ? `<div class="empty-state"><p>No .resx files found in this workspace.</p></div>`
        : groupsHtml;

    const body = `${createMasterAction}${treeOrEmptyState}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 6px 8px 16px;
      font-size: 13px;
    }
    .empty-state {
      padding: 8px 4px;
    }
    .empty-state p {
      opacity: 0.8;
      margin: 0 0 10px;
    }
    .create-master-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px;
      margin-bottom: 10px;
      border: 1px solid color-mix(in srgb, var(--vscode-charts-blue, var(--vscode-focusBorder)) 35%, transparent);
      border-radius: 4px;
      background: color-mix(in srgb, var(--vscode-charts-blue, var(--vscode-focusBorder)) 8%, transparent);
      color: var(--vscode-charts-blue, var(--vscode-textLink-foreground));
      font-family: var(--vscode-font-family);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
    }
    .create-master-btn:hover {
      background: color-mix(in srgb, var(--vscode-charts-blue, var(--vscode-focusBorder)) 16%, transparent);
    }
    details.group {
      margin-bottom: 4px;
    }
    details.group summary {
      list-style: none;
      cursor: pointer;
      padding: 4px 2px;
      font-weight: 600;
      opacity: 0.85;
      display: flex;
      align-items: center;
      gap: 6px;
      user-select: none;
    }
    details.group summary::-webkit-details-marker {
      display: none;
    }
    details.group summary:before {
      content: "▸";
      display: inline-block;
      transition: transform 0.1s ease;
      font-weight: normal;
      opacity: 0.7;
    }
    details.group[open] summary:before {
      transform: rotate(90deg);
    }
    .folder-icon {
      opacity: 0.9;
    }
    .group-items {
      padding-left: 6px;
      border-left: 1px solid var(--vscode-panel-border);
      margin-left: 8px;
    }
    .family {
      margin: 2px 0 8px;
    }
    .family-header {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      opacity: 0.6;
      padding: 2px 4px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 4px;
      border-radius: 3px;
      cursor: pointer;
    }
    .item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .item input {
      flex-shrink: 0;
    }
    .locale-badge {
      flex-shrink: 0;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 10px;
      font-weight: 400;
      letter-spacing: 0.3px;
      text-transform: lowercase;
      padding: 1px 5px;
      border-radius: 3px;
      min-width: 20px;
      text-align: center;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .locale-badge.master {
      background: var(--vscode-charts-blue, var(--vscode-badge-background));
    }
    .name {
      word-break: break-all;
    }
    .add-new {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 4px;
      margin-top: 2px;
      border-radius: 3px;
      cursor: pointer;
      opacity: 0.75;
    }
    .add-new:hover {
      opacity: 1;
      background: var(--vscode-list-hoverBackground);
    }
    .plus-icon {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      border: 1px solid currentColor;
      font-size: 11px;
      line-height: 1;
    }
  </style>
</head>
<body>
  ${body}
  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const checkboxes = Array.from(document.querySelectorAll(".file-checkbox"));

      function sendSelection() {
        const paths = checkboxes.filter((c) => c.checked).map((c) => c.dataset.path);
        if (paths.length === 0) return;
        vscode.postMessage({ command: "openTable", paths });
      }

      checkboxes.forEach((cb) => {
        cb.addEventListener("change", () => {
          if (cb.checked && cb.dataset.master !== "true") {
            const master = checkboxes.find(
              (c) => c.dataset.group === cb.dataset.group && c.dataset.master === "true"
            );
            if (master && !master.checked) {
              master.checked = true;
            }
          }
          sendSelection();
        });
      });

      window.addEventListener("message", (event) => {
        if (event.data?.command === "uncheckFiles" && Array.isArray(event.data.paths)) {
          const toUncheck = new Set(event.data.paths);
          checkboxes.forEach((cb) => {
            if (toUncheck.has(cb.dataset.path)) {
              cb.checked = false;
            }
          });
        }
      });

      document.querySelectorAll(".add-new").forEach((el) => {
        el.addEventListener("click", () => {
          const existing = (el.dataset.existing || "").split(",").filter(Boolean);
          vscode.postMessage({
            command: "addLocale",
            dir: el.dataset.dir,
            baseName: el.dataset.base,
            masterPath: el.dataset.masterPath || null,
            existing
          });
        });
      });

      const createMasterBtn = document.getElementById("createMasterBtn");
      if (createMasterBtn) {
        createMasterBtn.addEventListener("click", () => {
          vscode.postMessage({ command: "createMaster" });
        });
      }
    })();
  </script>
</body>
</html>`;
  }
}
