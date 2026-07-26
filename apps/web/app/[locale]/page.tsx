import { notFound } from "next/navigation";

import { MissionWizard } from "../../features/onboarding";
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

export default async function Home({
  params,
}: PageProps) {
  const { locale: localeParam } = await params;

  if (!isValidLocale(localeParam)) {
    notFound();
  }

  const locale: Locale = localeParam;
  const dictionary = await getDictionary(locale);

  return (
    <MissionWizard
      eyebrow="CreatorOS"
      title={dictionary.dashboard.headline}
      description="Antes de comenzar, vamos a configurar tu espacio de trabajo y definir la misión de crecimiento de tu canal."
      buttonLabel="Comenzar configuración"
    />
  );
}