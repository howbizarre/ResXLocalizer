import * as vscode from "vscode";
import { findResxGroups, groupResxFiles } from "./resxParser";
import { TablePanel } from "./tablePanel";
import { FileListProvider } from "./fileListProvider";

let lastOpenedUris: vscode.Uri[] | null = null;

async function openTable() {
  const groups = await findResxGroups();
  if (groups.length === 0) {
    vscode.window.showInformationMessage("Lokalizator: No .resx files found in this workspace.");
    return;
  }
  lastOpenedUris = null;
  TablePanel.show(groups);
}

async function openTableForUris(uris: vscode.Uri[]) {
  const groups = await groupResxFiles(uris);
  lastOpenedUris = uris;
  TablePanel.show(groups);
}

async function refreshOpenTable() {
  if (!TablePanel.currentPanel) {
    return;
  }
  if (lastOpenedUris) {
    await openTableForUris(lastOpenedUris);
  } else {
    await openTable();
  }
}

export function activate(context: vscode.ExtensionContext) {
  const fileListProvider = new FileListProvider((uris) => void openTableForUris(uris));

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(FileListProvider.viewType, fileListProvider),
    vscode.commands.registerCommand("lokalizator.openTable", () => openTable()),
    vscode.commands.registerCommand("lokalizator.refreshTable", () => {
      void fileListProvider.refresh();
      void refreshOpenTable();
    })
  );

  const watcher = vscode.workspace.createFileSystemWatcher("**/*.resx");
  watcher.onDidChange(() => void refreshOpenTable());
  const onStructuralChange = () => {
    void fileListProvider.refresh();
    void refreshOpenTable();
  };
  watcher.onDidCreate(onStructuralChange);
  watcher.onDidDelete(onStructuralChange);
  context.subscriptions.push(watcher);
}

export function deactivate() {}
