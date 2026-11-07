import { PHONE_PATTERN } from "@/lib/format";
import { submitPublicForm } from "@/lib/forms";
import { CrownC } from "./Brand";
import { makeT, type Locale } from "@/lib/i18n/core";

type Group = { id: string; name: string; ageRange: string | null; slots: { weekday: number; startTime: string }[]; full: boolean };

const WD = { en: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], pl: ["", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"] };

export function PublicForm({ slug, kind, groups, back, sent, error, clubName, locale }: {
  slug: string; kind: "trial" | "registration"; groups: Group[]; back: string; sent?: boolean; error?: boolean; clubName: string; locale: Locale;
}) {
  const t = makeT(locale);
  if (sent) {
    return (
      <div className="rounded-learner bg-mint p-6 text-center">
        <CrownC size={48} />
        <h2 className="h2 mt-2">{t("Thank you!")}</h2>
        <p className="mt-1 text-ink">{kind === "trial" ? t("{club} received your trial lesson request and will contact you soon.", { club: clubName }) : t("{club} received your registration and will contact you soon.", { club: clubName })}</p>
      </div>
    );
  }
  const L = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block"><span className="label">{label}</span>{children}</label>;
  return (
    <form action={submitPublicForm} className="space-y-4" lang={locale}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="lang" value={locale} />
      <div aria-hidden className="hidden"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      {error && <p className="rounded-control bg-red-50 p-2 text-sm text-red-800">{t("Please fill in all required fields (including the parent's phone number) and accept the privacy notice.")}</p>}
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-semibold text-forest">{t("Child")}</legend>
        <L label={t("First name") + " *"}><input className="input" name="childFirst" required maxLength={80} /></L>
        <L label={t("Last name") + " *"}><input className="input" name="childLast" required maxLength={80} /></L>
        <L label={t("Date of birth") + (kind === "registration" ? " *" : "")}><input className="input" name="childBirth" type="date" required={kind === "registration"} /></L>
        <L label={t("Group")}>
          <select className="input" name="groupId" defaultValue="">
            <option value="">{t("Not sure, please advise")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}{g.ageRange ? ` (${g.ageRange})` : ""} · {g.slots.map((s) => `${WD[locale][s.weekday]} ${s.startTime}`).join(", ")}{g.full ? ` · ${t("waitlist")}` : ""}
              </option>
            ))}
          </select>
        </L>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-semibold text-forest">{t("Parent / guardian")}</legend>
        <L label={t("First name") + " *"}><input className="input" name="parentFirst" required maxLength={80} /></L>
        <L label={t("Last name") + " *"}><input className="input" name="parentLast" required maxLength={80} /></L>
        <L label={t("Email") + " *"}><input className="input" name="parentEmail" type="email" required /></L>
        <L label={t("Phone") + " *"}><input className="input" name="parentPhone" type="tel" required pattern={PHONE_PATTERN} title={t("Phone number, at least 9 digits")} autoComplete="tel" maxLength={40} /></L>
      </fieldset>
      {kind === "trial" && <L label={t("Preferred trial date")}><input className="input" name="preferredDate" type="date" /></L>}
      <L label={kind === "trial" ? t("Chess experience / questions") : t("Anything we should know?")}><textarea className="input" name="message" rows={3} maxLength={2000} /></L>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>{t("I agree that {club} stores these details to handle my request and contact me about it.", { club: clubName })}{" "}
          {t("Data controller: Fundacja Młody Sportowiec. Details in the")} <a href="/polityka-prywatnosci" target="_blank" className="font-semibold text-forest underline">{t("Privacy policy")}</a>.</span>
      </label>
      <button className="btn btn-lg w-full sm:w-auto">{kind === "trial" ? t("Request a trial lesson") : t("Send registration")}</button>
    </form>
  );
}
