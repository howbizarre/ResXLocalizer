// Default region for a bare language code, used only when sibling files in the family
// already use region-qualified culture names (e.g. "de-DE") and we need to match that style.
const LANGUAGE_TO_REGION: Record<string, string> = {
  en: "US",
  bg: "BG",
  de: "DE",
  fr: "FR",
  es: "ES",
  it: "IT",
  pt: "PT",
  ru: "RU",
  uk: "UA",
  pl: "PL",
  cs: "CZ",
  sk: "SK",
  hu: "HU",
  ro: "RO",
  el: "GR",
  nl: "NL",
  sv: "SE",
  da: "DK",
  fi: "FI",
  no: "NO",
  tr: "TR",
  ja: "JP",
  ko: "KR",
  zh: "CN",
  ar: "SA",
  he: "IL",
  hi: "IN",
  th: "TH",
  vi: "VN",
  id: "ID",
  sr: "RS",
  hr: "HR",
  sl: "SI",
  lt: "LT",
  lv: "LV",
  et: "EE"
};

function detectRegionCasing(existingLocales: string[]): boolean | null {
  const withRegion = existingLocales.find((l) => l.includes("-"));
  if (!withRegion) {
    return null;
  }
  const region = withRegion.split("-")[1] ?? "";
  return region === region.toUpperCase();
}

/**
 * If sibling files in this .resx family use region-qualified culture names (e.g. "Strings.de-DE.resx"),
 * format a bare language code (e.g. "de") the same way. Locale codes the user typed explicitly
 * (already containing a region) are returned unchanged.
 */
export function applyFamilyConvention(locale: string, existingLocales: string[]): string {
  if (locale.includes("-")) {
    return locale;
  }

  const regionUpperCase = detectRegionCasing(existingLocales);
  if (regionUpperCase === null) {
    return locale;
  }

  const region = LANGUAGE_TO_REGION[locale.toLowerCase()];
  if (!region) {
    return locale;
  }

  const formattedRegion = regionUpperCase ? region.toUpperCase() : region.toLowerCase();
  return `${locale.toLowerCase()}-${formattedRegion}`;
}
