# Lokalizator

VSCode разширение, което визуализира `.resx` ресурси за локализация като таблица: колона `Key` + по една колона за всеки locale вариант (`Strings.resx`, `Strings.bg.resx`, `Strings.de.resx`, ...).

## Употреба

1. `npm install`
2. Натисни `F5` (Run Extension) — отваря се нов Extension Development Host прозорец.
3. В него отвори работна папка, съдържаща `.resx` файлове.
4. Command Palette → **Lokalizator: Open Resx Table** (или десен клик върху `.resx` файл в Explorer).

## Конвенция за групиране на файлове

Файловете се групират по базово име и директория:

- `Strings.resx` — базов (neutral) файл, колона `default`
- `Strings.bg.resx` — вариант за `bg`
- `Strings.de.resx` — вариант за `de`

Ключовете се вземат от обединението на всички `<data name="...">` елементи във всички файлове от групата; липсващ превод се маркира визуално.

## Development

- `npm run watch` — esbuild в watch режим
- `npm run check-types` — TypeScript проверка без емитване
- `npm run lint` — ESLint
- `npm run package` — production build (`npm run vscode:prepublish`)

## Roadmap

- Редактиране на стойности директно от таблицата (запис обратно в `.resx`)
- Филтриране/търсене по ключ
- Поддръжка на други формати за локализация (`.json`, `.po`, `.arb`, ...)
