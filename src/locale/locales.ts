/**
 * @module locale/locales
 * The "Add new" locale picker used by the sidebar ({@link ../panels/fileListProvider}) when
 * creating a new `.resx` variant for an existing file family.
 */
import * as vscode from "vscode";

/** One entry in the common-languages list offered by {@link pickLocale}. */
export interface LocaleOption {
  code: string;
  name: string;
}

/** ISO language codes offered by default in the "Add new" locale picker, before free typing. */
export const COMMON_LOCALES: LocaleOption[] = [
  { code: "en", name: "English" },
  { code: "bg", name: "Bulgarian" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "uk", name: "Ukrainian" },
  { code: "pl", name: "Polish" },
  { code: "cs", name: "Czech" },
  { code: "sk", name: "Slovak" },
  { code: "hu", name: "Hungarian" },
  { code: "ro", name: "Romanian" },
  { code: "el", name: "Greek" },
  { code: "nl", name: "Dutch" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
  { code: "fi", name: "Finnish" },
  { code: "no", name: "Norwegian" },
  { code: "tr", name: "Turkish" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "th", name: "Thai" },
  { code: "vi", name: "Vietnamese" },
  { code: "id", name: "Indonesian" },
  { code: "sr", name: "Serbian" },
  { code: "hr", name: "Croatian" },
  { code: "sl", name: "Slovenian" },
  { code: "lt", name: "Lithuanian" },
  { code: "lv", name: "Latvian" },
  { code: "et", name: "Estonian" }
];

const LOCALE_CODE_PATTERN = /^[a-zA-Z]{2}(-[a-zA-Z0-9]+)?$/;

/**
 * Shows a `QuickPick` of {@link COMMON_LOCALES} (already-used locales filtered out), and also
 * accepts a free-typed custom code (e.g. `pt-BR`) matching {@link LOCALE_CODE_PATTERN}.
 * @param exclude Locale codes (lowercase) to hide from the list, since they already exist in this family.
 * @returns The chosen/typed locale code, or `undefined` if the picker was dismissed.
 */
export async function pickLocale(exclude: Set<string>): Promise<string | undefined> {
  return new Promise((resolve) => {
    const baseItems: vscode.QuickPickItem[] = COMMON_LOCALES.filter(
      (l) => !exclude.has(l.code.toLowerCase())
    ).map((l) => ({ label: l.code, description: l.name }));

    const qp = vscode.window.createQuickPick();
    qp.placeholder = "Select a language or type a custom locale code (e.g. pt-BR)";
    qp.items = baseItems;

    qp.onDidChangeValue((value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        qp.items = baseItems;
        return;
      }
      const lower = trimmed.toLowerCase();
      const matches = baseItems.filter(
        (item) =>
          item.label.toLowerCase().includes(lower) ||
          (item.description ?? "").toLowerCase().includes(lower)
      );
      const exactExists = baseItems.some((item) => item.label.toLowerCase() === lower);
      if (!exactExists && LOCALE_CODE_PATTERN.test(trimmed) && !exclude.has(lower)) {
        matches.unshift({ label: trimmed, description: "Custom locale" });
      }
      qp.items = matches;
    });

    let resolved = false;
    qp.onDidAccept(() => {
      resolved = true;
      const selection = qp.selectedItems[0];
      qp.hide();
      resolve(selection?.label);
    });
    qp.onDidHide(() => {
      if (!resolved) {
        resolve(undefined);
      }
      qp.dispose();
    });
    qp.show();
  });
}
