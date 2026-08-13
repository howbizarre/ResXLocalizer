/**
 * @module panels/tablePanel
 * Owns the `WebviewPanel` for a single `.resx` family's translation table: one instance per
 * open tab, keyed by `dir::baseName`. Renders via {@link ../webview/renderTable}, and handles
 * every `postMessage` the webview sends (save/delete/addKey/export/import) by delegating to
 * {@link ../resx/saveTranslations} and {@link ../resx/exportImport}.
 */
import * as vscode from "vscode";
import { ResxGroup, groupResxFiles, parseResxFile } from "../resx/resxParser";
import { renderTableHtml } from "../webview/renderTable";
import { saveTranslations, deleteTranslationKey, TranslationEdit } from "../resx/saveTranslations";
import { buildCsvContent, buildJsonContent, parseImportContent, buildImportPlan } from "../resx/exportImport";
import { showImportLog } from "./importLogPanel";

/** Manages the lifecycle of every open translation-table tab. */
export class TablePanel {
  private static readonly panels = new Map<string, TablePanel>();
  private static readonly closeEmitter = new vscode.EventEmitter<vscode.Uri[]>();
  public static readonly onDidClose = TablePanel.closeEmitter.event;

  private readonly panel: vscode.WebviewPanel;
  private readonly groupKey: string;
  private disposables: vscode.Disposable[] = [];
  private currentUris: vscode.Uri[] = [];
  private currentGroup: ResxGroup | undefined;

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
        } else if (message?.command === "export") {
          void this.handleExport();
        } else if (message?.command === "import") {
          void this.handleImport();
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

  /** Re-parses each open panel's files from disk and re-renders it — used after any external file change. */
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

  /** Re-renders this panel's webview with fresh data and remembers `group` for later export/import/refresh. */
  public update(group: ResxGroup) {
    this.currentGroup = group;
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

  private async handleExport(): Promise<void> {
    const group = this.currentGroup;
    if (!group) {
      return;
    }

    const choice = await vscode.window.showQuickPick(
      [
        { label: "CSV", description: ".csv" },
        { label: "JSON", description: ".json" }
      ],
      { placeHolder: "Export format" }
    );
    if (!choice) {
      return;
    }

    const isCsv = choice.label === "CSV";
    const ext = isCsv ? "csv" : "json";
    const content = isCsv ? buildCsvContent(group) : buildJsonContent(group);
    const baseFile = group.files[0];
    const defaultUri = baseFile
      ? vscode.Uri.joinPath(baseFile.uri, "..", `${group.baseName}.${ext}`)
      : undefined;

    const target = await vscode.window.showSaveDialog({
      defaultUri,
      filters: isCsv ? { CSV: ["csv"] } : { JSON: ["json"] }
    });
    if (!target) {
      return;
    }

    await vscode.workspace.fs.writeFile(target, Buffer.from(content, "utf8"));
    vscode.window.showInformationMessage(`ResXLocalizer: Exported to ${target.fsPath}.`);
  }

  private async handleImport(): Promise<void> {
    const group = this.currentGroup;
    if (!group) {
      return;
    }

    const picked = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { "CSV / JSON": ["csv", "json"] },
      openLabel: "Import"
    });
    if (!picked || picked.length === 0) {
      return;
    }

    const fileUri = picked[0];
    const fileName = fileUri.path.split("/").pop() ?? fileUri.fsPath;
    const bytes = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(bytes).toString("utf8");

    const parsed = parseImportContent(fileName, text);
    if (parsed.errors.length > 0) {
      const shown = parsed.errors.slice(0, 20);
      const more = parsed.errors.length > shown.length ? `\n… and ${parsed.errors.length - shown.length} more.` : "";
      await vscode.window.showErrorMessage(
        `ResXLocalizer: import failed — ${parsed.errors.length} problem(s) found in "${fileName}". Nothing was changed.`,
        { modal: true, detail: shown.join("\n") + more }
      );
      return;
    }

    if (parsed.rows.length === 0) {
      vscode.window.showWarningMessage(`ResXLocalizer: "${fileName}" contained no rows to import.`);
      return;
    }

    const plan = buildImportPlan(group, parsed.rows);
    if (plan.edits.length === 0) {
      vscode.window.showWarningMessage(`ResXLocalizer: nothing to import from "${fileName}" — no matching columns/values found.`);
      return;
    }

    await saveTranslations(plan.edits);
    await this.refresh();

    const added = plan.log.filter((e) => e.action === "added").length;
    const overwritten = plan.log.filter((e) => e.action === "overwritten").length;
    vscode.window.showInformationMessage(
      `ResXLocalizer: import complete — ${added} value(s) added, ${overwritten} overwritten.`
    );

    if (overwritten > 0) {
      showImportLog(group.baseName, plan.log, plan.ignoredColumns, parsed.warnings);
    }
  }

  /** Unregisters this panel and notifies {@link onDidClose} listeners which files it owned. */
  public dispose() {
    TablePanel.panels.delete(this.groupKey);
    this.disposables.forEach((d) => d.dispose());
    TablePanel.closeEmitter.fire(this.currentUris);
  }
}
