import Link from "next/link";
import type { Metadata } from "next";
import { currentUser, homeFor } from "@/lib/auth";
import { featuredClub } from "@/lib/publicClub";
import { Logo, CrownC, MoveTrail, LeagueBadge, Medal } from "@/components/Brand";
import { ChessBoard } from "@/components/ChessBoard";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LegalLinks } from "@/components/LegalLinks";
import { getLocale } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";
import { weekday, money, fmtDate } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getLocale());
  return { title: { absolute: `ChessGo · ${t("Small moves. Big progress.")}` }, description: t("ChessGo connects weekly lessons, daily puzzles and real tournaments. Progress on a screen becomes an achievement at school.") };
}

// A legal, simple teaching position (back-rank mate in one: Rd8#).
const DEMO_FEN = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1";
const DEMO_TRAIL = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06", "2026-01-07"]
  .map((day, i) => ({ day, done: i !== 1 && i !== 6, today: i === 6 }));

export default async function Home() {
  const [user, locale, club] = await Promise.all([currentUser(), getLocale(), featuredClub()]);
  const t = makeT(locale);
  const trialHref = club ? `/c/${club.slug}/trial` : "/login";
  const minFee = club?.groups.length ? Math.min(...club.groups.map((g) => g.monthlyFeeCts)) : null;

  const Check = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="11" fill="#FDDA05" /><path d="M7 12.5l3.2 3.2L17 9" stroke="#0B3D2E" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
  const Bullet = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <li className="flex gap-3"><Check /><div><div className="font-semibold text-forest">{title}</div><div className="text-ink-soft">{children}</div></div></li>
  );

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1">
          <Link href="/" aria-label={t("ChessGo home")}><Logo width={180} /></Link>
          <nav className="hidden items-center gap-6 text-[15px] font-semibold text-forest lg:flex" aria-label={t("Main menu")}>
            <a href="#about" className="hover:underline">{t("About ChessGo")}</a>
            <a href="#families" className="hover:underline">{t("For families")}</a>
            <a href="#groups" className="hover:underline">{t("Groups & prices")}</a>
            <a href="#faq" className="hover:underline">{t("FAQ")}</a>
            <a href="#contact" className="hover:underline">{t("Contact")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitch locale={locale} className="hidden sm:inline-flex" />
            {user
              ? (user.mustChangePassword
                ? <a href="/account?first=1" className="btn">{t("Set a password to enter")}</a>
                : <a href={homeFor(user.role)} className="btn">{t("Go to my panel")}</a>)
              : <Link href="/login" className="btn-secondary">{t("Sign in")}</Link>}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 md:grid-cols-[1.15fr_1fr] md:pt-16">
          <div className="min-w-0">
            <p className="inline-block rounded-full bg-go px-4 py-1 text-sm font-semibold text-forest">{t("Chess for kids aged 6–16")}</p>
            <h1 className="mt-5 break-words font-display text-[34px] font-semibold leading-[42px] text-forest min-[380px]:text-[40px] min-[380px]:leading-[46px] sm:text-[48px] sm:leading-[56px]">{t("Small moves. Big progress.")}</h1>
            <p className="mt-5 max-w-xl text-lg leading-7 text-ink">{t("ChessGo connects weekly lessons, daily puzzles and real tournaments. Progress on a screen becomes an achievement at school.")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={trialHref} className="btn btn-lg">{t("Book a free trial")}</Link>
              <a href="#groups" className="btn-secondary btn-lg">{t("See groups and schedule")}</a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-ink">
              <li className="flex items-center gap-2"><Check />{t("Beginners welcome")}</li>
              <li className="flex items-center gap-2"><Check />{t("Small groups")}</li>
              <li className="flex items-center gap-2"><Check />{t("First lesson free")}</li>
            </ul>
          </div>
          <div className="relative min-w-0">
            <div className="card-learner shadow-[0_20px_60px_-30px_rgba(11,61,46,0.45)]">
              <div className="flex items-center justify-between gap-3">
                <span className="pill">{t("Daily puzzle")}</span>
                <LeagueBadge level={4} />
              </div>
              <h2 className="mt-3 font-display text-xl font-semibold text-forest">{t("Ready for your next move?")}</h2>
              <div className="mt-4 flex justify-center"><ChessBoard fen={DEMO_FEN} size={264} /></div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-learner bg-mint p-3">
                <span className="text-sm font-semibold text-forest">{t("Move Trail")}</span>
                <MoveTrail days={DEMO_TRAIL} size={20} />
              </div>
            </div>
          </div>
        </section>

        {/* What is ChessGo */}
        <section id="about" className="scroll-mt-20 bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="font-display text-[32px] font-semibold leading-10 text-forest">{t("What is ChessGo?")}</h2>
            <p className="mt-3 max-w-3xl text-lg text-ink">{t("ChessGo is a chess club for children and teenagers, with lessons in small groups and an app that keeps the progress visible for students and parents.")}</p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                { icon: "🧩", h: t("Play every day"), p: t("Short lessons and one daily puzzle make regular practice achievable.") },
                { icon: "🧭", h: t("Learn with care"), p: t("Friendly coaches and helpful feedback build understanding and confidence.") },
                { icon: "🏆", h: t("Win together"), p: t("Club tournaments and earned rewards build team spirit.") },
              ].map((c) => (
                <div key={c.h} className="rounded-learner bg-cream p-6">
                  <div className="text-3xl" aria-hidden>{c.icon}</div>
                  <h3 className="mt-3 font-display text-xl font-semibold text-forest">{c.h}</h3>
                  <p className="mt-2 text-ink">{c.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* For students */}
        <section className="py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{t("For students")}</p>
              <h2 className="mt-2 font-display text-[32px] font-semibold leading-10 text-forest">{t("Progress you can see")}</h2>
              <ul className="mt-6 space-y-4">
                <Bullet title={t("A daily puzzle")}>{t("One position a day, a few minutes of thinking. Every solved puzzle adds a step to the Move Trail.")}</Bullet>
                <Bullet title={t("XP, levels and leagues")}>{t("Points for lessons, puzzles and tournament games. Leagues from Discovery to Mastery.")}</Bullet>
                <Bullet title={t("Badges and medals")}>{t("Earned for attendance, puzzles and tournaments, never for purchases.")}</Bullet>
                <Bullet title={t("A missed day is a fresh start")}>{t("No pressure and no shame: just the next good move.")}</Bullet>
              </ul>
            </div>
            <div className="card-learner">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {([1, 2, 3, 0] as const).map((p) => (
                  <div key={p} className="flex flex-col items-center gap-2 rounded-card bg-cream p-3 text-center">
                    <Medal place={p} size={40} label={p ? `${t(["", "Gold", "Silver", "Bronze"][p])} ${t("medal")}` : t("Participation")} />
                    <span className="text-sm font-semibold text-forest">{p ? `${t(["", "Gold", "Silver", "Bronze"][p])}` : t("Participation")}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                <LeagueBadge level={1} /><LeagueBadge level={4} /><LeagueBadge level={7} /><LeagueBadge level={10} />
              </div>
            </div>
          </div>
        </section>

        {/* For parents & schools */}
        <section id="families" className="scroll-mt-20 bg-white py-16">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2">
            <div className="rounded-learner bg-mint p-7">
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{t("For parents")}</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-forest">{t("Calm, clear and useful")}</h2>
              <ul className="mt-5 space-y-4">
                <Bullet title={t("Progress and attendance")}>{t("See lessons attended, solved puzzles and earned badges in your parent account.")}</Bullet>
                <Bullet title={t("Fees in one place")}>{t("Clear due dates for club fees, plus the club shop with T-shirts, chess sets and books.")}</Bullet>
                <Bullet title={t("Privacy first")}>{t("Rankings show first names only, there are no child photos in the app, and data is used only to run the club.")}</Bullet>
              </ul>
            </div>
            <div className="rounded-learner bg-cream p-7">
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{t("For schools and coaches")}</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-forest">{t("A chess club that runs itself")}</h2>
              <ul className="mt-5 space-y-4">
                <Bullet title={t("Attendance in a minute")}>{t("Mark the group, and XP and badges update automatically.")}</Bullet>
                <Bullet title={t("Tournaments made simple")}>{t("Add players, pair rounds automatically, enter results, crown the winner.")}</Bullet>
                <Bullet title={t("Reports and payments")}>{t("Attendance trends, revenue, overdue fees and group fill rates, with CSV export.")}</Bullet>
              </ul>
              {club?.email && <a href={`mailto:${club.email}?subject=ChessGo`} className="btn-secondary mt-6">{t("Bring ChessGo to your school")}</a>}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="font-display text-[32px] font-semibold leading-10 text-forest">{t("How to start")}</h2>
            <ol className="mt-8 grid gap-5 md:grid-cols-3">
              {[
                { h: t("Book a free trial"), p: t("Fill in a short form. We'll reply and agree a date.") },
                { h: t("Join a group"), p: t("We'll suggest a group that fits your child's age and level.") },
                { h: t("Play and grow"), p: t("Lessons at the club, a daily puzzle at home, and progress you can see.") },
              ].map((s, i) => (
                <li key={s.h} className="card-learner flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-go font-display text-lg font-bold text-forest">{i + 1}</span>
                  <div><h3 className="font-display text-lg font-semibold text-forest">{s.h}</h3><p className="mt-1 text-ink">{s.p}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Groups & prices (live) */}
        {club && (
          <section id="groups" className="scroll-mt-20 bg-white py-16">
            <div className="mx-auto max-w-6xl px-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-[32px] font-semibold leading-10 text-forest">{t("Groups & prices")}</h2>
                  <p className="mt-2 text-ink-soft">{club.name}{club.address ? ` · ${club.address}` : ""}</p>
                </div>
                <Link href={`/c/${club.slug}`} className="font-semibold text-forest underline">{t("Full club page →")}</Link>
              </div>
              {club.groups.length === 0 ? (
                <div className="mt-6 rounded-learner bg-mint p-6">
                  <p className="text-ink">{t("Group times will be published here soon. Book a free trial and we'll find the right group together.")}</p>
                  <Link href={trialHref} className="btn mt-4">{t("Book a free trial")}</Link>
                </div>
              ) : (
                <>
                  {minFee !== null && <p className="mt-2 text-ink">{t("Monthly fee from {price}. The first lesson is free.", { price: money(minFee, club.currency) })}</p>}
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {club.groups.map((g) => {
                      const free = g.capacity - g._count.students;
                      return (
                        <div key={g.id} className="flex flex-col rounded-learner border border-ink/10 bg-cream p-5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-display text-xl font-semibold text-forest">{g.name}</h3>
                            <span className={`pill ${free <= 0 ? "pill-amber" : "pill-green"}`}>{free <= 0 ? t("waitlist") : `${t("Free places")}: ${free}`}</span>
                          </div>
                          <p className="muted">{[g.level, g.ageRange && `${t("ages")} ${g.ageRange}`].filter(Boolean).join(" · ")}</p>
                          <ul className="mt-3 space-y-0.5 text-[15px] text-ink">{g.slots.map((s) => <li key={s.id}>{weekday(s.weekday)} {s.startTime}–{s.endTime}{s.location ? ` · ${s.location}` : ""}</li>)}</ul>
                          {g.coach && <p className="muted mt-2">{t("Coach")}: {g.coach.name}</p>}
                          <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                            <span className="font-display text-lg font-semibold text-forest">{money(g.monthlyFeeCts, club.currency)}<span className="text-sm font-normal text-ink-soft"> / {t("month")}</span></span>
                            <Link href={trialHref} className="btn btn-sm">{t("Free trial")}</Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* Coaches (live) */}
        {club && club.users.length > 0 && (
          <section className="py-16">
            <div className="mx-auto max-w-6xl px-4">
              <h2 className="font-display text-[32px] font-semibold leading-10 text-forest">{t("Our coaches")}</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {club.users.map((c) => (
                  <div key={c.id} className="card-learner flex gap-4">
                    {c.photoUrl ? <img src={c.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-mint"><CrownC size={36} /></div>}
                    <div><div className="font-display text-lg font-semibold text-forest">{c.name}</div><p className="text-ink-soft">{c.bio}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* News (live) */}
        {club && club.news.length > 0 && (
          <section className="bg-white py-16">
            <div className="mx-auto max-w-6xl px-4">
              <h2 className="font-display text-[32px] font-semibold leading-10 text-forest">{t("News")}</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {club.news.slice(0, 3).map((n) => (
                  <article key={n.id} className="rounded-learner bg-cream p-5">
                    <p className="muted">{fmtDate(n.publishedAt)}</p>
                    <h3 className="mt-1 font-display text-lg font-semibold text-forest">{n.title}</h3>
                    <p className="mt-2 line-clamp-4 whitespace-pre-line text-ink">{n.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-16">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="font-display text-[32px] font-semibold leading-10 text-forest">{t("Questions from parents")}</h2>
            <div className="mt-6 space-y-3">
              {[
                [t("Does my child need to know how to play?"), t("No. We have groups for complete beginners and teach everything from the first move.")],
                [t("What age is ChessGo for?"), t("For children and teenagers aged about 6 to 16. Groups are matched by age and level.")],
                [t("What should we bring?"), t("Just curiosity. Before the first lesson we'll tell you everything you need to know.")],
                [t("How do we see progress?"), t("Parents get their own account with attendance, solved puzzles, badges and club fees.")],
                [t("How do payments work?"), t("Club fees are monthly. You'll see the amount and due date in your parent account and can pay at the club.")],
                [t("What happens after the trial lesson?"), t("If your child enjoyed it, we register them in a group. No obligation.")],
              ].map(([q, a]) => (
                <details key={q} className="group rounded-card border border-ink/10 bg-white p-5 open:bg-mint">
                  <summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between gap-3 font-semibold text-forest">
                    {q}<span aria-hidden className="text-xl transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-ink">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="on-forest bg-forest py-16 text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4">
            <div>
              <h2 className="font-display text-[32px] font-semibold leading-10">{t("Ready for the first move?")}</h2>
              <p className="mt-2 text-lg text-white/85">{t("Book a free trial lesson. We'll take care of the rest.")}</p>
            </div>
            <Link href={trialHref} className="btn-reward btn-lg">{t("Book a free trial")}</Link>
          </div>
        </section>
      </main>

      {/* Footer / contact */}
      <footer id="contact" className="scroll-mt-20 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
          <div>
            <Logo width={180} className="-ml-[13px]" />
            <p className="mt-2 text-ink-soft">{t("Small moves. Big progress.")}</p>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-forest">{t("Contact")}</h2>
            {club ? (
              <ul className="mt-2 space-y-1 text-ink">
                <li className="font-semibold">{club.name}</li>
                {club.address && <li>{club.address}</li>}
                {club.email && <li><a className="underline" href={`mailto:${club.email}`}>{club.email}</a></li>}
                {club.phone && <li><a className="underline" href={`tel:${club.phone.replace(/\s/g, "")}`}>{club.phone}</a></li>}
              </ul>
            ) : <p className="mt-2 text-ink-soft">—</p>}
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-forest">{t("Quick links")}</h2>
            <ul className="mt-2 space-y-1">
              <li><Link className="text-forest underline" href={trialHref}>{t("Book a free trial")}</Link></li>
              {club && <li><Link className="text-forest underline" href={`/c/${club.slug}/register`}>{t("Register")}</Link></li>}
              {club && <li><Link className="text-forest underline" href={`/c/${club.slug}`}>{t("Club page")}</Link></li>}
              <li><Link className="text-forest underline" href="/login">{t("Sign in")}</Link></li>
            </ul>
            <LanguageSwitch locale={locale} className="mt-4" />
          </div>
        </div>
        <div className="border-t border-ink/10 py-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4"><LegalLinks t={t} /><span className="text-sm text-ink-soft">© {new Date().getFullYear()} ChessGo</span></div></div>
      </footer>
    </div>
  );
}
