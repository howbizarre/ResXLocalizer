<img src="media/marketplace-icon.png" alt="ResXLocalizer logo" width="84" align="left">

# ResXLocalizer

<br clear="left" />

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/howbizarre.resxlocalizer?label=VS%20Marketplace&color=0e639c)](https://marketplace.visualstudio.com/items?itemName=HowBizarre.resxlocalizer)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](LICENSE)

[🇧🇬 Български](README_BG.md) | 🇬🇧 English

A Visual Studio Code extension that shows your `.resx` localization resources (the same files Visual Studio uses for `.NET` projects) as one convenient table: **key + one column per language**, instead of opening and comparing several XML files by hand.

![Translation table](media/screenshots/table-view.png)

---

## Table of contents

- [What the extension does](#what-the-extension-does)
- [Installation](#installation)
- [Getting started](#getting-started)
- [Sidebar — file list](#sidebar--file-list)
- [Translation table](#translation-table)
- [Exporting and importing](#exporting-and-importing)
- [How files are grouped](#how-files-are-grouped)
- [For translators (no coding experience needed)](#for-translators-no-coding-experience-needed)
- [For C# / Visual Studio developers](#for-c--visual-studio-developers)
- [Developing the extension itself](#developing-the-extension-itself)
- [Roadmap](#roadmap)
- [License](#license)

---

## What the extension does

- **Visualizes every `.resx` file in a "family"** (e.g. `Strings.resx`, `Strings.bg.resx`, `Strings.de.resx`) as **one table**: a row per key, a column per language.
- **In-place editing** — you edit values directly in the table, and the extension writes them back into the correct `.resx` files, **preserving existing comments and formatting** (it never rewrites the whole file).
- **Adding a new translation (new key)** through a permanent "New key" row pinned to the top of the table.
- **Deleting a key** from every language at once, with a confirmation prompt first.
- **Highlights missing/untranslated values in red**, so you immediately see which translations are still missing.
- **Per-column filtering** (by key or by translated value); filters on different columns combine — you only see rows that match all of them at once.
- **Export the table to CSV or JSON**, and **import** translations back from a CSV/JSON file — validated before anything is written, with a review log if existing values got overwritten.
- **Sidebar view** in the Activity Bar with a tree of every `.resx` file in the project, grouped by folder and by "family" — check a box to open that file in a table.
- **Add a new language** to an existing file family directly from the sidebar — pick from a list of common languages, or type any custom locale code (e.g. `pt-BR`); the new file is created automatically with every key from the base file, ready to be translated.
- **Create a brand-new "master" `.resx` file** if the project doesn't have one yet.
- **Auto-detects the base language** (e.g. "en") from `.csproj`/`.vbproj` (`<NeutralLanguage>`) or `AssemblyInfo` (`NeutralResourcesLanguage`) — the same settings your .NET project already uses.
- **Auto-refreshes** — if a file is changed, added, or deleted on disk (e.g. via `git pull` or another editor), the table and sidebar update themselves.
- Each `.resx` "family" opens in its **own tab**, so different tables never mix together.

---

## Installation

### Option A — from the Marketplace (recommended)

Search for **"ResXLocalizer"** in the Extensions view (`Ctrl+Shift+X`) inside VS Code, or install it directly from its [Marketplace page](https://marketplace.visualstudio.com/items?itemName=HowBizarre.resxlocalizer).

### Option B — from a `.vsix` file

Useful if someone gave you a specific build directly (e.g. a pre-release), instead of installing through the Marketplace.

1. Download the `resxlocalizer-X.X.X.vsix` file (X.X.X is the version number).
2. Open **Visual Studio Code**.
3. In the icon bar on the left (**Activity Bar**), open **Extensions** (the icon looks like 4 little squares ▦), or press `Ctrl+Shift+X`.
4. At the top-right of the Extensions panel, click the three-dot button **`...`**.
5. Choose **"Install from VSIX..."**.
6. Point it at the downloaded `.vsix` file and confirm.
7. Once installation finishes, VS Code will offer to **Reload** (or "Restart Extensions") — click it.

Or, from the terminal:

```bash
code --install-extension resxlocalizer-0.0.1.vsix
```

> **Tip:** whenever you install a newer version of the extension over an older one, always run **Reload Window** (`Ctrl+Shift+P` → "Developer: Reload Window") afterwards — otherwise VS Code may keep showing the old version in panels that are already open.

---

## Getting started

1. **Open the project's workspace folder**: **File → Open Folder...** and pick the project's root folder (the one that contains the `.csproj` file).
2. A new icon — **ResXLocalizer** — appears in the **Activity Bar** on the left. Click it to open the sidebar panel.
3. The extension automatically scans the whole folder for `.resx` files:

   - **If there are `.resx` files already** — you'll see a tree of folders and files (see the next section).
   - **If there are none yet** — you'll just see a short message and a button:

     ![Empty state — create a new file](media/screenshots/empty-state.png)

     Clicking **"Create master .resx file"** walks you through two simple steps: pick a folder, then type a name (e.g. `Strings`) — the extension creates an empty, valid `.resx` file (the same structure Visual Studio generates), ready for your first keys.

4. Check the box next to the files you want to see in a table (see below), or right-click a `.resx` file in the regular VS Code Explorer → **"ResXLocalizer: Open Resx Table"**.

---

## Sidebar — file list

![Sidebar file list](media/screenshots/sidebar-view.png)

Files are organized as a tree:

- **Folder** (📁) — matching the real folder structure of the project.
- **Family** (e.g. `LOGINPAGE`) — every `.resx` file with the same base name in that folder: the base (default) file plus its per-language variants.
- Each file has a colored language **badge**:
  - **blue badge** = the base ("master") file — the one with no language code in its name (`LoginPage.resx`). If the project declares `<NeutralLanguage>` in its `.csproj`, the badge shows that exact language (e.g. `en`) instead of the generic "src".
  - **grey badge** = a specific translation (`bg`, `de`, `fr`, ...).

**Checking a box opens the table** with the selected files (or adds them to an already-open table for that family). If you only check a translation (e.g. `bg`), the base file gets checked automatically too — the table always shows at least the default column, for context.

**"Add new"** under each family adds a new language to it:

1. Click **"+ Add new"**.
2. A list of common languages appears (English, Bulgarian, German, French...) — pick one with the mouse/arrow keys, or **type your own code** (e.g. `pt-BR`, `zh-Hant`) if it isn't in the list.
3. The extension creates a new `.resx` file (e.g. `LoginPage.pt-BR.resx`) with **every key from the base file, but with empty values** — ready to be translated.
4. If the other files in the family already use a region-qualified format (e.g. `de-DE` instead of just `de`), the new file automatically follows the same format, for consistency.

The **⟳ (Refresh)** button at the top of the panel reloads the list manually (you usually won't need it — the extension already watches the files automatically).

---

## Translation table

Each `.resx` family opens in its own tab as a table:

| Column | Content |
|---|---|
| **Actions** | Buttons to edit/delete that row |
| **Key** | The key's name (shared across all languages) |
| **Default** / language | One column per `.resx` file in the family |

### Editing a translation

1. Click the **✏️ blue pencil** at the start of the row → the row's cells become editable, and the icon turns into a **💾 green save icon**.
2. Change the text in any cell (directly, like a plain text field).
3. Click the green icon again to **save**. The values are written back into each corresponding `.resx` file — the file's comments and formatting are left untouched; only the value changes.

### Deleting a key

Click the **🗑️ red trash icon** next to the row → a confirmation dialog appears → once confirmed, the key is removed from **every** language file on that row.

### Adding a new key

There's always a special **"New key"** row pinned to the top of the table:

1. Click its pencil icon to make it editable.
2. Type the key's name into the first cell, and the values for each language.
3. Click save. If the key field is empty, it's outlined in red and the save is rejected. If the key you typed already exists in the group, you'll be asked whether to overwrite its value.

### Missing translations

A cell with no value (or only whitespace) is highlighted with a **red accent** on its left edge — you immediately see which language variants are still waiting for a translation.

### Filtering

Under every column header (except Actions) there's a **Filter...** field — type text and only rows whose value in that column contains it are shown (case-insensitive). Filters on different columns combine — for example, a filter of `Login` on Key plus `error` on BG shows only rows matching **both** conditions at once.

---

## Exporting and importing

Two buttons sit above each table, at the top right: **⬇ Export** and **⬆ Import**.

### Export

Click **Export**, choose **CSV** or **JSON**, then pick where to save it. The file contains one row per key, with a column per language (the base file's column is called `default`) — the same shape you see in the table.

### Import

Click **Import** and pick a `.csv` or `.json` file. Before anything is written to your `.resx` files, the extension validates the file:

- the file must parse correctly (valid CSV/JSON), with a `Key` column/field on every row;
- if any row is malformed or missing its key, the import is **rejected entirely** — a dialog lists the problems found, and nothing gets changed.

Once validation passes:

- rows with a **key that doesn't exist yet** are added as new translations;
- rows with a **key that already exists** overwrite the existing value for that language — this is logged;
- blank cells are skipped (they never erase an existing translation);
- columns that don't match any language file open in this table are ignored.

If any existing values were overwritten, a **new tab opens automatically** right after the import finishes, listing every overwritten key with its old and new value side by side, so you can review exactly what changed.

---

## How files are grouped

The extension recognizes files using .NET's resource-naming convention:

- `Strings.resx` — the base ("neutral") file → shown as the default column.
- `Strings.bg.resx` — the Bulgarian variant.
- `Strings.de-DE.resx` — the German (Germany) variant, with a region.

Every file sharing the same base name (`Strings`) in the same folder forms one "family" and is shown together in one table. The keys shown are the union of the keys from every file in the group — so it's immediately obvious if a key only exists in some of the languages.

---

## For translators (no coding experience needed)

If your job is **just to translate text**, don't worry about the rest of this document — here's all you need:

1. Open the project in VS Code (someone on the dev team has already set it up and given you a link/folder).
2. Click the **ResXLocalizer** icon in the left-hand bar.
3. Check the box next to your language (e.g. `bg`) in the list — a table will open.
4. Look for rows highlighted in **red** — those are the missing translations.
5. For each row: click the **pencil** ✏️, fill in the translation in your column, then click the **save icon** 💾 (it turns green while you're editing).
6. Done — the change is saved automatically to the file. Nothing else is needed (no "Save As", no terminal).

**You don't need to** touch the **Key** column on existing rows, or delete files — just fill in the values in your own column.

---

## For C# / Visual Studio developers

If you're coming from **Visual Studio** and this extension is the first reason you're opening VS Code, here's a quick "dictionary" between the two environments:

| Visual Studio | VS Code + ResXLocalizer |
|---|---|
| **Solution Explorer** | **Explorer** panel (the files icon, top-left) |
| Double-click a `.resx` → built-in Resource Designer | Right-click a `.resx` → **"ResXLocalizer: Open Resx Table"**, or check its box in the extension's sidebar |
| Adding a new `.resx` for a new language by hand (copy/paste + rename) | The **"Add new"** button in the sidebar — creates the file and fills in every key automatically |
| `<NeutralLanguage>` in `.csproj` | Detected automatically and shown as a badge on the base file |

For peace of mind: the extension **never touches the project, its references, or the `.csproj`** — it only reads and writes the `.resx` files themselves, preserving the XML structure that `ResXFileCodeGenerator` in Visual Studio expects. You can freely move the project between both editors — the files stay fully compatible with Visual Studio even after being edited through ResXLocalizer.

Because changes are minimal diffs in the XML itself (just a changed value, or one added `<data>` block), git diffs stay clean and easy to review in a pull request.

---

## Developing the extension itself

For anyone building or maintaining ResXLocalizer itself:

- `npm install` — install dependencies.
- `npm run watch` — esbuild in watch mode (for `F5` debugging in an Extension Development Host).
- `npm run check-types` — TypeScript check with no emitted output.
- `npm run lint` — ESLint.
- `npm run package` — production build (invoked by `vscode:prepublish`).
- `npm run vsix` — package the extension into a `.vsix` file (`@vscode/vsce`).

---

## Roadmap

- Support for other localization formats (`.json`, `.po`, `.arb`, ...)

---

## License

ResXLocalizer is distributed under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**.

In short (full terms are in [LICENSE](LICENSE)):

- ✅ You're free to **use** it, **modify/extend** it, and **share** it with others — both in its original and in a modified form.
- ✅ The only requirement is giving credit to the original source (author + a link to the license), and that a modified version must be shared under the same license.
- ❌ It (or a modified version of it) may **not** be **sold**, **rented out/subscribed to**, or otherwise used for commercial gain.

Full legal license text: <https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode>
Human-readable summary: <https://creativecommons.org/licenses/by-nc-sa/4.0/>
