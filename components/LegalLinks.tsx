import Link from "next/link";
import type { T } from "@/lib/i18n/core";

/** Footer links to the legal pages + operator line. */
export function LegalLinks({ t, className = "" }: { t: T; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft ${className}`}>
      <Link href="/regulamin" className="underline hover:text-forest">{t("Terms of service")}</Link>
      <Link href="/polityka-prywatnosci" className="underline hover:text-forest">{t("Privacy policy")}</Link>
      <Link href="/cookies" className="underline hover:text-forest">{t("Cookie policy")}</Link>
      <span>{t("Operator: Fundacja Młody Sportowiec, KRS 0000794149")}</span>
    </div>
  );
}
