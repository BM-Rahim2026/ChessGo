import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { privacy } from "@/lib/legal/privacy";
import { legalCtx } from "@/lib/legal/ctx";
import { OPERATOR } from "@/lib/legal/operator";
import { getLocale } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";
import { fmtDate } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const doc = privacy(await getLocale(), await legalCtx());
  return { title: doc.title };
}

export default async function Page() {
  const locale = await getLocale();
  const t = makeT(locale);
  const doc = privacy(locale, await legalCtx());
  return (
    <LegalPage locale={locale} title={doc.title} intro={doc.intro} sections={doc.sections}
      updated={t("Effective from {date}", { date: fmtDate(new Date(OPERATOR.effectiveDate + "T12:00:00Z")) })}
      other={[{ href: "/regulamin", label: t("Terms of service") }, { href: "/polityka-prywatnosci", label: t("Privacy policy") }, { href: "/cookies", label: t("Cookie policy") }]} />
  );
}
