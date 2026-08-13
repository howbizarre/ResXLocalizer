import * as vscode from "vscode";
import { buildEmptyResxContent } from "./resxTemplate";

/**
 * Prompts for a folder (native OS picker, supports creating a new folder) and a file name,
 * then creates an empty master .resx file there and opens it for editing.
 */
export async function createMasterResxFile(): Promise<void> {
  const folderUris = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: "Select Folder",
    title: "Choose a folder for the master .resx file",
    defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri
  });
  if (!folderUris || folderUris.length === 0) {
    return;
  }
  const folderUri = folderUris[0];

  const baseName = await vscode.window.showInputBox({
    prompt: "Name for the master resource file (without extension)",
    value: "Strings",
    validateInput: (value) => (value.trim() ? undefined : "Enter a name")
  });
  if (!baseName) {
    return;
  }

  const fileUri = vscode.Uri.joinPath(folderUri, `${baseName.trim()}.resx`);

  try {
    await vscode.workspace.fs.stat(fileUri);
    vscode.window.showWarningMessage(`ResXLocalizer: ${baseName.trim()}.resx already exists.`);
    return;
  } catch {
    // Does not exist yet — safe to create.
  }

  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(buildEmptyResxContent([]), "utf8"));

  const doc = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(doc, { preview: false });
}
