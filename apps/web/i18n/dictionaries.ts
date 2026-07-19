import type { Locale } from "./config";

const dictionaries = {
  es: () => import("../messages/es.json").then((module) => module.default),
  en: () => import("../messages/en.json").then((module) => module.default),
  "pt-BR": () =>
    import("../messages/pt-BR.json").then((module) => module.default),
  fr: () => import("../messages/fr.json").then((module) => module.default),
};

export type Dictionary = Awaited<
  ReturnType<(typeof dictionaries)[Locale]>
>;

export async function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}