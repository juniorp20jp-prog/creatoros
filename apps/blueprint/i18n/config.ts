export const locales = ["es", "en", "pt-BR", "fr"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "es";

export const localeNames: Record<Locale, string> = {
  es: "Español",
  en: "English",
  "pt-BR": "Português",
  fr: "Français",
};

export function isValidLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}