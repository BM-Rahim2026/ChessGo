import type { Section } from "@/components/LegalPage";
import type { Locale } from "@/lib/i18n/core";
import { OPERATOR as O } from "./operator";
import type { LegalCtx } from "./terms";

export function cookies(locale: Locale, c: LegalCtx): { title: string; intro: string; sections: Section[] } {
  if (locale === "en") return {
    title: "Cookie Policy",
    intro: "ChessGo uses only cookies that are strictly necessary for the service to work. We do not use analytics, advertising or tracking cookies, so no consent banner is needed. The Polish version is binding.",
    sections: [
      { h: "What cookies are", body: ["Cookies are small text files stored by your browser. Strictly necessary cookies may be used without consent because the service cannot work without them."] },
      { h: "Cookies we use", body: [{ list: [
        "cg_session — keeps you signed in; set only after you sign in; HttpOnly; expires after 30 days or when you sign out.",
        "cg_lang — remembers your language choice (Polish/English); 12 months.",
        "Stripe cookies — set by Stripe on its checkout page (checkout.stripe.com) to process payments securely and prevent fraud; governed by Stripe’s own cookie policy.",
      ]}] },
      { h: "Managing cookies", body: ["You can delete or block cookies in your browser settings. Blocking the necessary cookies will prevent you from signing in or keeping your language choice."] },
      { h: "Contact", body: [`${O.name}, ${c.email}. More in the Privacy Policy.`] },
    ],
  };
  return {
    title: "Polityka cookies",
    intro: "Serwis ChessGo używa wyłącznie plików cookies niezbędnych do jego działania. Nie stosujemy plików cookies analitycznych, reklamowych ani śledzących, dlatego nie wyświetlamy banera zgody.",
    sections: [
      { h: "Czym są pliki cookies", body: [
        "Pliki cookies to niewielkie pliki tekstowe zapisywane przez przeglądarkę na Twoim urządzeniu. Zgodnie z przepisami prawa komunikacji elektronicznej pliki cookies niezbędne do świadczenia usługi, o którą prosisz, mogą być stosowane bez Twojej zgody.",
      ]},
      { h: "Jakich plików cookies używamy", body: [{ list: [
        "cg_session – utrzymuje zalogowanie; zapisywany dopiero po zalogowaniu; niedostępny dla skryptów (HttpOnly); wygasa po 30 dniach lub po wylogowaniu.",
        "cg_lang – zapamiętuje wybór języka (polski / angielski); 12 miesięcy.",
        "Pliki cookies Stripe – zapisywane przez Stripe na stronie płatności (checkout.stripe.com) w celu bezpiecznej realizacji płatności i zapobiegania oszustwom; zasady określa polityka cookies Stripe.",
      ]}]},
      { h: "Zarządzanie plikami cookies", body: [
        "Możesz usunąć lub zablokować pliki cookies w ustawieniach swojej przeglądarki. Zablokowanie plików niezbędnych uniemożliwi logowanie oraz zapamiętanie wybranego języka.",
      ]},
      { h: "Kontakt", body: [`${O.name}, e-mail: ${c.email}. Więcej informacji o danych osobowych znajdziesz w Polityce prywatności.`] },
    ],
  };
}
