/**
 * @module extension
 * Activation entry point: registers commands, the sidebar view, and the `.resx` file watcher
 * that keeps every open table (and the sidebar) in sync with changes made outside the extension
 * (git pull, another editor, etc.). See `docs/ARCHITECTURE.md` for the full module map.
 */
import * as vscode from "vscode";
import { findResxGroups, groupResxFiles } from "./resx/resxParser";
import { TablePanel } from "./panels/tablePanel";
import { FileListProvider } from "./panels/fileListProvider";
import { createMasterResxFile } from "./resx/createMaster";

/** Command: "ResXLocalizer: Open Resx Table" — auto-discovers every `.resx` family in the workspace. */
async function openTable() {
  const groups = await findResxGroups();
  if (groups.length === 0) {
    const choice = await vscode.window.showInformationMessage(
      "ResXLocalizer: No .resx files found in this workspace.",
      "Create master .resx file"
    );
    if (choice) {
      await createMasterResxFile();
    }
    return;
  }
  TablePanel.show(groups);
}

/** Groups the given files (e.g. from the sidebar's checked boxes) and opens/updates their table. */
async function openTableForUris(uris: vscode.Uri[]) {
  const groups = await groupResxFiles(uris);
  TablePanel.show(groups);
}

/** Called once by VS Code when the extension activates. */
export function activate(context: vscode.ExtensionContext) {
  const fileListProvider = new FileListProvider((uris) => void openTableForUris(uris));

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(FileListProvider.viewType, fileListProvider),
    vscode.commands.registerCommand("resxlocalizer.openTable", () => openTable()),
    vscode.commands.registerCommand("resxlocalizer.refreshTable", () => {
      void fileListProvider.refresh();
      void TablePanel.refreshAll();
    }),
    TablePanel.onDidClose((uris) => {
      fileListProvider.uncheckFiles(uris.map((u) => u.fsPath));
    })
  );

  const watcher = vscode.workspace.createFileSystemWatcher("**/*.resx");
  watcher.onDidChange(() => void TablePanel.refreshAll());
  const onStructuralChange = () => {
    void fileListProvider.refresh();
    void TablePanel.refreshAll();
  };
  watcher.onDidCreate(onStructuralChange);
  watcher.onDidDelete(onStructuralChange);
  context.subscriptions.push(watcher);
}

/** No cleanup needed — all disposables are already registered via `context.subscriptions`. */
export function deactivate() {}
