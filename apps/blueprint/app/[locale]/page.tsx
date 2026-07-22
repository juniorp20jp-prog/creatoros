import { notFound } from "next/navigation";

import { BlueprintDashboard } from "../../features/blueprint-dashboard";
import {
  isValidLocale,
  type Locale,
} from "../../i18n/config";
import { getDictionary } from "../../i18n/dictionaries";

type PageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function BlueprintHome({
  params,
}: PageProps) {
  const { locale: localeParam } = await params;

  if (!isValidLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const dictionary = await getDictionary(locale);

  return (
    <BlueprintDashboard dictionary={dictionary} locale={locale} />
  );
}
