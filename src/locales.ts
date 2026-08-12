import * as vscode from "vscode";

export interface LocaleOption {
  code: string;
  name: string;
}

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
