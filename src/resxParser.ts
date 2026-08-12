import * as vscode from "vscode";
import { XMLParser } from "fast-xml-parser";

/** A single `<data name="Key"><value>Text</value></data>` entry from a .resx file. */
export interface ResxEntry {
  key: string;
  value: string;
  comment?: string;
}

/** One `.resx` file: either the neutral/default file or a locale variant (`Name.bg.resx`). */
export interface ResxFile {
  uri: vscode.Uri;
  locale: string | null; // null = neutral/default file
  entries: Map<string, ResxEntry>;
}

/** All `.resx` files sharing the same base name (e.g. `Strings.resx`, `Strings.bg.resx`, `Strings.de.resx`). */
export interface ResxGroup {
  /** Base name without locale suffix or extension, e.g. "Strings". */
  baseName: string;
  /** Directory containing the files, used to disambiguate same-named groups in different folders. */
  dir: string;
  files: ResxFile[];
}

const RESX_NAME_PATTERN = /^(.*?)(?:\.([a-zA-Z]{2}(?:-[a-zA-Z0-9]+)?))?\.resx$/;

export function parseResxFileName(fileName: string): { baseName: string; locale: string | null } {
  const match = RESX_NAME_PATTERN.exec(fileName);
  if (!match) {
    return { baseName: fileName.replace(/\.resx$/i, ""), locale: null };
  }
  const [, baseName, locale] = match;
  return { baseName, locale: locale ?? null };
}

export async function findResxFiles(): Promise<vscode.Uri[]> {
  return vscode.workspace.findFiles("**/*.resx", "**/node_modules/**");
}

export async function parseResxFile(uri: vscode.Uri): Promise<ResxFile> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  const xml = Buffer.from(bytes).toString("utf8");

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: false
  });

  const doc = parser.parse(xml);
  const rawData = doc?.root?.data;
  const dataNodes: any[] = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];

  const entries = new Map<string, ResxEntry>();
  for (const node of dataNodes) {
    const key = node?.["@_name"];
    if (!key) {
      continue;
    }
    const value = typeof node?.value === "object" ? node.value["#text"] ?? "" : node?.value ?? "";
    const comment = typeof node?.comment === "object" ? node.comment["#text"] : node?.comment;
    entries.set(key, { key, value: String(value), comment });
  }

  const fileName = uri.path.split("/").pop() ?? "";
  const { locale } = parseResxFileName(fileName);

  return { uri, locale, entries };
}

export async function groupResxFiles(uris: vscode.Uri[]): Promise<ResxGroup[]> {
  const groups = new Map<string, ResxGroup>();

  for (const uri of uris) {
    const fileName = uri.path.split("/").pop() ?? "";
    const dir = uri.path.slice(0, uri.path.length - fileName.length - 1);
    const { baseName } = parseResxFileName(fileName);
    const groupKey = `${dir}::${baseName}`;

    const file = await parseResxFile(uri);

    let group = groups.get(groupKey);
    if (!group) {
      group = { baseName, dir, files: [] };
      groups.set(groupKey, group);
    }
    group.files.push(file);
  }

  for (const group of groups.values()) {
    group.files.sort((a, b) => {
      if (a.locale === b.locale) { return 0; }
      if (a.locale === null) { return -1; }
      if (b.locale === null) { return 1; }
      return a.locale.localeCompare(b.locale);
    });
  }

  return Array.from(groups.values()).sort((a, b) => a.baseName.localeCompare(b.baseName));
}

export async function findResxGroups(): Promise<ResxGroup[]> {
  return groupResxFiles(await findResxFiles());
}
