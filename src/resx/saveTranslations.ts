/**
 * @module resx/saveTranslations
 * Writes key/value edits back into existing `.resx` files via targeted regex patches,
 * rather than re-serializing the whole XML document — this is what preserves each file's
 * existing comments/formatting. The counterpart to {@link ../resx/resxParser} (which reads).
 */
import * as vscode from "vscode";
import { escapeXml } from "./resxTemplate";

/** One `key` → `value` write, targeting a specific `.resx` file (`file` is an fsPath). */
export interface TranslationEdit {
  file: string;
  key: string;
  value: string;
}

function buildDataBlockRegex(key: string): RegExp {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(<data\\s+name=(["'])${escapedKey}\\2[^>]*>[\\s\\S]*?<value[^>]*>)([\\s\\S]*?)(<\\/value>)`, "m");
}

function insertDataBlock(xml: string, key: string, value: string): string {
  const block = `  <data name="${escapeXml(key)}" xml:space="preserve">\n    <value>${escapeXml(value)}</value>\n  </data>\n`;
  const closingIndex = xml.lastIndexOf("</root>");
  if (closingIndex === -1) {
    return xml + block;
  }
  return xml.slice(0, closingIndex) + block + xml.slice(closingIndex);
}

function buildFullDataBlockRegex(key: string): RegExp {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`[ \\t]*<data\\s+name=(["'])${escapedKey}\\1[^>]*>[\\s\\S]*?<\\/data>\\r?\\n?`, "m");
}

async function writeIfChanged(filePath: string, transform: (text: string) => string): Promise<void> {
  const uri = vscode.Uri.file(filePath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const originalText = doc.getText();
  const text = transform(originalText);

  if (text === originalText) {
    return;
  }

  const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(originalText.length));
  const workspaceEdit = new vscode.WorkspaceEdit();
  workspaceEdit.replace(uri, fullRange, text);
  await vscode.workspace.applyEdit(workspaceEdit);
  await doc.save();
}

/** Applies key/value edits to their owning .resx files, patching existing <data> blocks in place
 *  (preserving comments/formatting) and inserting new ones for keys that don't exist yet. */
export async function saveTranslations(edits: TranslationEdit[]): Promise<void> {
  const byFile = new Map<string, TranslationEdit[]>();
  for (const edit of edits) {
    const list = byFile.get(edit.file) ?? [];
    list.push(edit);
    byFile.set(edit.file, list);
  }

  for (const [filePath, fileEdits] of byFile) {
    await writeIfChanged(filePath, (originalText) => {
      let text = originalText;
      for (const edit of fileEdits) {
        const regex = buildDataBlockRegex(edit.key);
        if (regex.test(text)) {
          text = text.replace(regex, (_match, prefix, _quote, _oldValue, closing) => `${prefix}${escapeXml(edit.value)}${closing}`);
        } else {
          text = insertDataBlock(text, edit.key, edit.value);
        }
      }
      return text;
    });
  }
}

/** Removes the <data> block for the given key from each file, if present. */
export async function deleteTranslationKey(key: string, files: string[]): Promise<void> {
  const uniqueFiles = Array.from(new Set(files));
  const regex = buildFullDataBlockRegex(key);

  for (const filePath of uniqueFiles) {
    await writeIfChanged(filePath, (originalText) => originalText.replace(regex, ""));
  }
}
