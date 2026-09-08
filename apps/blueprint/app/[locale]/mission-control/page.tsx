import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MissionControlAnalysisExperience } from "../../../features/mission-control-analysis";
import {
  isValidLocale,
  type Locale,
} from "../../../i18n/config";
import { getDictionary } from "../../../i18n/dictionaries";

type MissionControlPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ mode?: string }>;
};

async function resolveLocale(
  params: MissionControlPageProps["params"],
): Promise<Locale> {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  return locale;
}

export async function generateMetadata({
  params,
}: MissionControlPageProps): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dictionary = await getDictionary(locale);
  return dictionary.blueprint.missionControl.metadata;
}

export default async function MissionControlPage({
  params,
  searchParams,
}: MissionControlPageProps) {
  const locale = await resolveLocale(params);
  const dictionary = await getDictionary(locale);
  const mode = (await searchParams)?.mode === "demo" ? "demo" : "real";
  return (
    <MissionControlAnalysisExperience
      content={dictionary.blueprint.missionControl}
      locale={locale}
      mode={mode}
    />
  );
}