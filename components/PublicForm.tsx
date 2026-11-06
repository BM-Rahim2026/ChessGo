import { submitPublicForm } from "@/lib/forms";
import { WEEKDAYS } from "@/lib/format";
import { CrownC } from "./Brand";

type Group = { id: string; name: string; ageRange: string | null; slots: { weekday: number; startTime: string }[]; full: boolean };

export function PublicForm({ slug, kind, groups, back, sent, error, clubName }: {
  slug: string; kind: "trial" | "registration"; groups: Group[]; back: string; sent?: boolean; error?: boolean; clubName: string;
}) {
  if (sent) {
    return (
      <div className="rounded-learner bg-mint p-6 text-center">
        <CrownC size={48} />
        <h2 className="h2 mt-2">Thank you!</h2>
        <p className="mt-1 text-ink">{clubName} received your {kind === "trial" ? "trial lesson request" : "registration"} and will contact you soon.</p>
      </div>
    );
  }
  const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block"><span className="label">{t}</span>{children}</label>;
  return (
    <form action={submitPublicForm} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="back" value={back} />
      <div aria-hidden className="hidden"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      {error && <p className="rounded-control bg-red-50 p-2 text-sm text-red-800">Please fill in all required fields and accept the privacy notice.</p>}
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-semibold text-forest">Child</legend>
        <L t="First name *"><input className="input" name="childFirst" required maxLength={80} /></L>
        <L t="Last name *"><input className="input" name="childLast" required maxLength={80} /></L>
        <L t={`Date of birth${kind === "registration" ? " *" : ""}`}><input className="input" name="childBirth" type="date" required={kind === "registration"} /></L>
        <L t="Group">
          <select className="input" name="groupId" defaultValue="">
            <option value="">Not sure, please advise</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}{g.ageRange ? ` (${g.ageRange})` : ""} · {g.slots.map((s) => `${WEEKDAYS[s.weekday]} ${s.startTime}`).join(", ")}{g.full ? " · waitlist" : ""}
              </option>
            ))}
          </select>
        </L>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-display text-lg font-semibold text-forest">Parent / guardian</legend>
        <L t="First name *"><input className="input" name="parentFirst" required maxLength={80} /></L>
        <L t="Last name *"><input className="input" name="parentLast" required maxLength={80} /></L>
        <L t="Email *"><input className="input" name="parentEmail" type="email" required /></L>
        <L t="Phone"><input className="input" name="parentPhone" type="tel" /></L>
      </fieldset>
      {kind === "trial" && <L t="Preferred trial date"><input className="input" name="preferredDate" type="date" /></L>}
      <L t={kind === "trial" ? "Chess experience / questions" : "Anything we should know?"}><textarea className="input" name="message" rows={3} maxLength={2000} /></L>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>I agree that {clubName} stores these details to handle my request and contact me about it.</span>
      </label>
      <button className="btn btn-lg w-full sm:w-auto">{kind === "trial" ? "Request a trial lesson" : "Send registration"}</button>
    </form>
  );
}
