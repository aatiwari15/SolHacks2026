/**
 * Language helpers for Unidad's ESL-first voice pipeline.
 * Maps ISO 639-1 language codes to BCP-47 locales used by Twilio <Say>/<Gather>.
 */

const LOCALE_MAP: Record<string, string> = {
  es: "es-MX",
  en: "en-US",
  pt: "pt-BR",
  fr: "fr-FR",
  zh: "zh-CN",
  ar: "ar-SA",
  hi: "hi-IN",
  vi: "vi-VN",
  ko: "ko-KR",
  tl: "tl-PH",
  ru: "ru-RU",
  pl: "pl-PL",
};

/**
 * Convert a short language code to a Twilio-compatible locale.
 * Falls back to "en-US" for unknown codes.
 *
 * @example languageToSayLocale("es") // → "es-MX"
 */
export function languageToSayLocale(lang: string): string {
  const key = lang.toLowerCase().split("-")[0];
  return LOCALE_MAP[key] ?? "en-US";
}
