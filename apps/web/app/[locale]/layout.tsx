import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { CreatorShell } from "../../components/shared/layout/CreatorShell";
import {
  isValidLocale,
  locales,
  type Locale,
} from "../../i18n/config";
import { getDictionary } from "../../i18n/dictionaries";

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({
    locale,
  }));
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale: localeParam } = await params;

  if (!isValidLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const dictionary = await getDictionary(locale);

  return (
    <CreatorShell
      dictionary={dictionary}
      locale={locale}
    >
      {children}
    </CreatorShell>
  );
}