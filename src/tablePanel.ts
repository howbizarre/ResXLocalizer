import * as vscode from "vscode";
import { ResxGroup, groupResxFiles, parseResxFile } from "./resxParser";
import { renderTableHtml } from "./renderTable";
import { saveTranslations, deleteTranslationKey, TranslationEdit } from "./saveTranslations";

export class TablePanel {
  private static readonly panels = new Map<string, TablePanel>();
  private static readonly closeEmitter = new vscode.EventEmitter<vscode.Uri[]>();
  public static readonly onDidClose = TablePanel.closeEmitter.event;

  private readonly panel: vscode.WebviewPanel;
  private readonly groupKey: string;
  private disposables: vscode.Disposable[] = [];
  private currentUris: vscode.Uri[] = [];

  private constructor(panel: vscode.WebviewPanel, groupKey: string) {
    this.panel = panel;
    this.groupKey = groupKey;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        if (message?.command === "save" && Array.isArray(message.edits)) {
          void this.handleSave(message.edits as TranslationEdit[]);
        } else if (message?.command === "delete" && typeof message.key === "string" && Array.isArray(message.files)) {
          void this.handleDelete(message.key, message.files as string[]);
        } else if (message?.command === "addKey" && typeof message.key === "string" && Array.isArray(message.edits)) {
          void this.handleAddKey(message.key, message.edits as TranslationEdit[]);
        }
      },
      null,
      this.disposables
    );
  }

  /** Opens (or reveals/updates) one panel per resx family — each family gets its own tab. */
  public static show(groups: ResxGroup[]) {
    for (const group of groups) {
      TablePanel.showGroup(group);
    }
  }

  public static async refreshAll(): Promise<void> {
    for (const instance of TablePanel.panels.values()) {
      await instance.refresh();
    }
  }

  private static showGroup(group: ResxGroup) {
    const key = `${group.dir}::${group.baseName}`;
    const uris = group.files.map((f) => f.uri);

    const existing = TablePanel.panels.get(key);
    if (existing) {
      existing.currentUris = uris;
      existing.panel.reveal(vscode.ViewColumn.One);
      existing.update(group);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "resxlocalizerTable",
      `ResXLocalizer: ${group.baseName}`,
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    const instance = new TablePanel(panel, key);
    instance.currentUris = uris;
    TablePanel.panels.set(key, instance);
    instance.update(group);
  }

  public update(group: ResxGroup) {
    this.panel.webview.html = renderTableHtml([group]);
  }

  private async refresh(): Promise<void> {
    const groups = await groupResxFiles(this.currentUris);
    if (groups.length > 0) {
      this.update(groups[0]);
    }
  }

  private async handleSave(edits: TranslationEdit[]): Promise<void> {
    if (edits.length === 0) {
      return;
    }
    await saveTranslations(edits);
    await this.refresh();
    vscode.window.showInformationMessage("ResXLocalizer: Translations saved.");
  }

  private async handleAddKey(key: string, edits: TranslationEdit[]): Promise<void> {
    if (edits.length === 0) {
      return;
    }

    let exists = false;
    for (const edit of edits) {
      try {
        const file = await parseResxFile(vscode.Uri.file(edit.file));
        if (file.entries.has(key)) {
          exists = true;
          break;
        }
      } catch {
        // Unreadable file — ignore for the duplicate check, saveTranslations will surface the real error.
      }
    }

    if (exists) {
      const choice = await vscode.window.showWarningMessage(
        `Key "${key}" already exists. Overwrite its value(s)?`,
        { modal: true },
        "Overwrite"
      );
      if (choice !== "Overwrite") {
        return;
      }
    }

    await saveTranslations(edits);
    await this.refresh();
    vscode.window.showInformationMessage(`ResXLocalizer: Saved "${key}".`);
  }

  private async handleDelete(key: string, files: string[]): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      `Delete "${key}" from ${files.length} file(s)? This cannot be undone from the table.`,
      { modal: true },
      "Delete"
    );
    if (choice !== "Delete") {
      return;
    }

    await deleteTranslationKey(key, files);
    await this.refresh();
    vscode.window.showInformationMessage(`ResXLocalizer: Deleted "${key}".`);
  }

  public dispose() {
    TablePanel.panels.delete(this.groupKey);
    this.disposables.forEach((d) => d.dispose());
    TablePanel.closeEmitter.fire(this.currentUris);
  }
}
