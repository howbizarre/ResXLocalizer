import * as vscode from "vscode";
import { findResxGroups, groupResxFiles } from "./resxParser";
import { TablePanel } from "./tablePanel";
import { FileListProvider } from "./fileListProvider";
import { createMasterResxFile } from "./createMaster";

let lastOpenedUris: vscode.Uri[] | null = null;

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
    vscode.commands.registerCommand("resxlocalizer.openTable", () => openTable()),
    vscode.commands.registerCommand("resxlocalizer.refreshTable", () => {
      void fileListProvider.refresh();
      void refreshOpenTable();
    }),
    TablePanel.onDidClose(() => {
      lastOpenedUris = null;
      fileListProvider.clearSelection();
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
