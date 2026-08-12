import * as vscode from "vscode";
import { findResxFiles } from "./resxParser";

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

export class FileListProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "lokalizator.fileListView";

  private view: vscode.WebviewView | undefined;

  constructor(private readonly onOpenTable: (uris: vscode.Uri[]) => void) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message?.command === "openTable" && Array.isArray(message.paths)) {
        const uris = (message.paths as string[]).map((p) => vscode.Uri.file(p));
        if (uris.length > 0) {
          this.onOpenTable(uris);
        }
      }
    });
    void this.refresh();
  }

  public async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    const uris = await findResxFiles();
    uris.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    this.view.webview.html = this.renderHtml(uris);
  }

  private renderHtml(uris: vscode.Uri[]): string {
    const nonce = getNonce();
    const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;

    const items = uris
      .map((uri) => {
        const label = escapeHtml(vscode.workspace.asRelativePath(uri, true));
        const path = escapeHtml(uri.fsPath);
        return `<label class="item"><input type="checkbox" class="file-checkbox" data-path="${path}" /><span>${label}</span></label>`;
      })
      .join("\n");

    const body =
      uris.length === 0
        ? `<p class="empty">No .resx files found in this workspace.</p>`
        : `<div id="list">${items}</div><button id="editBtn">Edit</button>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 8px;
      font-size: 13px;
    }
    .empty {
      opacity: 0.8;
    }
    .item {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 3px 0;
      cursor: pointer;
      word-break: break-all;
    }
    .item input {
      margin-top: 2px;
      flex-shrink: 0;
    }
    button {
      margin-top: 12px;
      width: 100%;
      padding: 6px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      display: none;
    }
    button.visible {
      display: block;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  ${body}
  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const checkboxes = Array.from(document.querySelectorAll(".file-checkbox"));
      const btn = document.getElementById("editBtn");
      if (!btn) return;

      function updateButton() {
        const checkedCount = checkboxes.filter((c) => c.checked).length;
        btn.classList.toggle("visible", checkedCount > 1);
      }

      checkboxes.forEach((cb) => cb.addEventListener("change", updateButton));

      btn.addEventListener("click", () => {
        const paths = checkboxes.filter((c) => c.checked).map((c) => c.dataset.path);
        vscode.postMessage({ command: "openTable", paths });
      });
    })();
  </script>
</body>
</html>`;
  }
}
