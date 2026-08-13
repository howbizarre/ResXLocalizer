/**
 * @module locale/neutralLanguage
 * Detects the .NET project's declared "neutral" (master) language, so the sidebar
 * ({@link ../panels/fileListProvider}) can label the base `.resx` file with a real language
 * code (e.g. `en`) instead of the generic "src" fallback.
 */
import * as vscode from "vscode";

/** Reduces a culture code like `en-US` or `en_GB` down to its bare 2-letter language part. */
function normalizeToTwoLetters(code: string): string {
  return code.split(/[-_]/)[0].toLowerCase().slice(0, 2);
}

async function readText(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString("utf8");
}

const NEUTRAL_LANGUAGE_TAG = /<NeutralLanguage>\s*([a-zA-Z]{2}(?:-[a-zA-Z0-9]+)?)\s*<\/NeutralLanguage>/i;
const NEUTRAL_RESOURCES_ATTRIBUTE = /NeutralResourcesLanguage\s*\(\s*"([a-zA-Z]{2}(?:-[a-zA-Z0-9]+)?)"/i;

/**
 * Best-effort detection of the "master" .resx language: .NET projects declare it via
 * `<NeutralLanguage>` in the .csproj/.vbproj or the `NeutralResourcesLanguage` assembly attribute.
 */
export async function detectNeutralLanguage(): Promise<string | null> {
  const projectFiles = await vscode.workspace.findFiles("**/*.{csproj,vbproj}", "**/node_modules/**", 20);
  for (const uri of projectFiles) {
    const match = NEUTRAL_LANGUAGE_TAG.exec(await readText(uri));
    if (match) {
      return normalizeToTwoLetters(match[1]);
    }
  }

  const assemblyInfoFiles = await vscode.workspace.findFiles("**/AssemblyInfo.{cs,vb}", "**/node_modules/**", 20);
  for (const uri of assemblyInfoFiles) {
    const match = NEUTRAL_RESOURCES_ATTRIBUTE.exec(await readText(uri));
    if (match) {
      return normalizeToTwoLetters(match[1]);
    }
  }

  return null;
}

export { normalizeToTwoLetters };
