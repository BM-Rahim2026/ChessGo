import type { Section } from "@/components/LegalPage";
import type { Locale } from "@/lib/i18n/core";
import { OPERATOR as O, nipFormatted } from "./operator";
import type { LegalCtx } from "./terms";

const addr = `${O.street}, ${O.postcode} ${O.city}`;

export function privacy(locale: Locale, c: LegalCtx): { title: string; intro: string; sections: Section[] } {
  if (locale === "en") return privacyEn(c);
  return {
    title: "Polityka prywatności",
    intro: "W tej polityce wyjaśniamy, jakie dane osobowe przetwarzamy w serwisie ChessGo, w jakim celu, jak długo i jakie prawa Ci przysługują. Dbamy szczególnie o dane dzieci: w rankingach pokazujemy tylko imiona, a w aplikacji nie publikujemy zdjęć dzieci.",
    sections: [
      { h: "Administrator danych", body: [
        `Administratorem danych osobowych jest ${O.name}, ${addr}, KRS ${O.krs}, NIP ${nipFormatted(O.nip)}, REGON ${O.regon} (dalej: „Administrator” lub „Fundacja”).`,
        `W sprawach dotyczących danych osobowych możesz kontaktować się z nami e-mailem: ${c.email} lub listownie na adres Fundacji.`,
      ]},
      { h: "Jakie dane przetwarzamy", body: [{ list: [
        "Rodzice / opiekunowie: imię, nazwisko, adres e-mail, numer telefonu, dane Konta, informacje o opłatach, zamówieniach i płatnościach (bez danych kart – obsługuje je Stripe).",
        "Uczniowie (dzieci): imię, nazwisko, data urodzenia, grupa i plan zajęć, obecności, wyniki zadań szachowych, punkty XP, poziomy, odznaki, wyniki turniejowe, notatki trenera związane z zajęciami; opcjonalnie adres e-mail do Konta Ucznia.",
        "Trenerzy i kadra: imię, nazwisko, adres e-mail, a za zgodą – opis i zdjęcie publikowane na stronie klubu.",
        "Osoby odwiedzające Serwis i wypełniające formularze: dane z formularza zgłoszeniowego oraz dane techniczne (adres IP, informacje o przeglądarce i urządzeniu, logi serwera).",
      ]}]},
      { h: "Skąd mamy dane", body: [
        "Dane otrzymujemy bezpośrednio od Rodziców (formularze, zapisy, kontakt z klubem), od samych Użytkowników (Konto) oraz od trenerów, którzy w trakcie zajęć odnotowują obecności i wyniki. Dane Ucznia przekazuje Rodzic.",
      ]},
      { h: "Cele i podstawy prawne przetwarzania", body: [{ list: [
        "Obsługa zgłoszeń na zajęcia próbne i zapisów – podjęcie działań na żądanie osoby przed zawarciem umowy (art. 6 ust. 1 lit. b RODO).",
        "Prowadzenie zajęć, grup, Kont, obecności, postępów, zadań i grywalizacji – wykonanie umowy z Rodzicem o udział Ucznia w zajęciach (art. 6 ust. 1 lit. b RODO).",
        "Rozliczanie opłat, obsługa Sklepu i płatności – wykonanie umowy (art. 6 ust. 1 lit. b RODO) oraz obowiązki prawne wynikające z przepisów o rachunkowości i podatkach (art. 6 ust. 1 lit. c RODO).",
        "Wysyłanie wiadomości o opłatach, zajęciach i Koncie – wykonanie umowy oraz prawnie uzasadniony interes Administratora (art. 6 ust. 1 lit. b i f RODO).",
        "Ranking grupy (wyłącznie imiona) i motywacyjne elementy grywalizacji – prawnie uzasadniony interes polegający na wspieraniu regularnej nauki (art. 6 ust. 1 lit. f RODO); można wnieść sprzeciw.",
        "Publikacja opisu i zdjęcia trenera na stronie klubu – zgoda (art. 6 ust. 1 lit. a RODO), którą można w każdej chwili wycofać.",
        "Zapewnienie bezpieczeństwa Serwisu, prowadzenie logów oraz ustalenie, dochodzenie i obrona roszczeń – prawnie uzasadniony interes (art. 6 ust. 1 lit. f RODO).",
      ]}]},
      { h: "Odbiorcy danych", body: [
        "Dane powierzamy wyłącznie podmiotom, które pomagają nam prowadzić Serwis, na podstawie umów powierzenia przetwarzania lub jako odrębnym administratorom w zakresie ich usług:",
        { list: [
          "Vercel Inc. (USA) – hosting aplikacji;",
          "Supabase Inc. (USA) – hosting bazy danych;",
          "Stripe Payments Europe, Ltd. (Irlandia) – obsługa płatności online (BLIK, Przelewy24, karty); w zakresie własnych obowiązków Stripe działa jako odrębny administrator;",
          "Resend (Plus Five Five, Inc., USA) – wysyłka wiadomości e-mail z Serwisu (jeżeli jest włączona);",
          "rejestrator domeny oraz podmioty świadczące nam usługi księgowe i prawne;",
          "organy publiczne – wyłącznie gdy wymagają tego przepisy prawa.",
        ]},
        "Dane nie są sprzedawane ani wykorzystywane do reklam.",
      ]},
      { h: "Przekazywanie danych poza Europejski Obszar Gospodarczy", body: [
        "Niektórzy dostawcy (Vercel, Supabase, Resend) mają siedzibę w USA i mogą przetwarzać dane poza EOG. Przekazanie odbywa się na podstawie decyzji Komisji Europejskiej stwierdzającej odpowiedni stopień ochrony (EU-US Data Privacy Framework) w przypadku dostawców uczestniczących w tym programie lub na podstawie standardowych klauzul umownych zatwierdzonych przez Komisję Europejską. Kopię zabezpieczeń można otrzymać, kontaktując się z nami.",
      ]},
      { h: "Jak długo przechowujemy dane", body: [{ list: [
        "Dane Kont, Uczniów i dotyczące zajęć – przez czas uczestnictwa w zajęciach, a następnie do upływu terminów przedawnienia roszczeń (co do zasady 6 lat, dla roszczeń okresowych 3 lata).",
        "Dokumentacja rozliczeń i płatności – przez 5 lat od końca roku obrotowego, w którym nastąpiła płatność (przepisy o rachunkowości).",
        "Zgłoszenia z formularzy, które nie zakończyły się zapisem – do 12 miesięcy od zgłoszenia.",
        "Dane przetwarzane na podstawie zgody – do jej wycofania.",
        "Logi techniczne – przez krótki okres niezbędny do zapewnienia bezpieczeństwa (zwykle nie dłużej niż 30 dni).",
      ]}]},
      { h: "Twoje prawa", body: [
        "Masz prawo do: dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych, wniesienia sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie oraz do wycofania zgody w dowolnym momencie (bez wpływu na zgodność z prawem przetwarzania przed jej wycofaniem).",
        `Aby skorzystać z praw, napisz na ${c.email}. Prawa Ucznia wykonuje w jego imieniu Rodzic.`,
        "Masz także prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).",
      ]},
      { h: "Dobrowolność podania danych", body: [
        "Podanie danych jest dobrowolne, ale niezbędne do zapisania Ucznia na zajęcia, prowadzenia Konta, rozliczeń i realizacji zamówień. Bez nich nie możemy świadczyć tych usług.",
      ]},
      { h: "Zautomatyzowane decyzje", body: [
        "Nie podejmujemy decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu, które wywołują skutki prawne lub w podobny sposób istotnie wpływają na osobę. Punkty XP, poziomy i odznaki są elementami motywacyjnymi i nie mają takich skutków.",
      ]},
      { h: "Bezpieczeństwo", body: [
        "Stosujemy środki techniczne i organizacyjne odpowiednie do ryzyka, m.in. szyfrowane połączenie (HTTPS), hasła przechowywane wyłącznie w postaci skrótów (hash), dostęp do danych ograniczony do ról (administrator klubu, trener, rodzic, uczeń) oraz płatności obsługiwane przez certyfikowanego operatora.",
      ]},
      { h: "Pliki cookies i zmiany polityki", body: [
        "Serwis używa wyłącznie niezbędnych plików cookies – szczegóły w Polityce cookies.",
        "Politykę możemy aktualizować, np. w razie zmiany przepisów lub dostawców. Aktualna wersja jest zawsze dostępna w Serwisie wraz z datą obowiązywania.",
      ]},
    ],
  };
}

function privacyEn(c: LegalCtx): { title: string; intro: string; sections: Section[] } {
  return {
    title: "Privacy Policy",
    intro: "This policy explains what personal data ChessGo processes, why, for how long and what your rights are. We take particular care with children’s data: rankings show first names only and the app publishes no photos of children. The Polish version is binding.",
    sections: [
      { h: "Controller", body: [`The controller is ${O.name}, ${addr}, Poland, KRS ${O.krs}, NIP ${nipFormatted(O.nip)}, REGON ${O.regon}. Contact: ${c.email}.`] },
      { h: "Data we process", body: [{ list: [
        "Parents/guardians: name, email, phone, account data, fees, orders and payments (no card data — handled by Stripe).",
        "Students (children): name, date of birth, group, attendance, puzzle results, XP, levels, badges, tournament results, coach notes; optionally an email for the student account.",
        "Coaches/staff: name, email and, with consent, a bio and photo on the club page.",
        "Visitors and form users: form data and technical data (IP address, browser/device information, server logs).",
      ]}]},
      { h: "Sources", body: ["From Parents (forms, enrolment), from users themselves (accounts) and from coaches recording attendance and results."] },
      { h: "Purposes and legal bases", body: [{ list: [
        "Trial and registration requests — steps prior to a contract (Art. 6(1)(b) GDPR).",
        "Running classes, accounts, attendance, progress, puzzles and gamification — performance of the contract (Art. 6(1)(b)).",
        "Fees, shop and payments — contract (Art. 6(1)(b)) and accounting/tax obligations (Art. 6(1)(c)).",
        "Messages about fees, classes and accounts — contract and legitimate interest (Art. 6(1)(b),(f)).",
        "Group ranking (first names only) and motivational features — legitimate interest (Art. 6(1)(f)); you may object.",
        "Coach bio/photo on the club page — consent (Art. 6(1)(a)), revocable at any time.",
        "Security, logs and legal claims — legitimate interest (Art. 6(1)(f)).",
      ]}]},
      { h: "Recipients", body: [{ list: [
        "Vercel Inc. (USA) — app hosting; Supabase Inc. (USA) — database hosting;",
        "Stripe Payments Europe, Ltd. (Ireland) — online payments (also an independent controller for its own obligations);",
        "Resend (Plus Five Five, Inc., USA) — email delivery (if enabled); domain registrar, accounting and legal advisers; public authorities where required by law.",
      ]}, "We do not sell data or use it for advertising."] },
      { h: "Transfers outside the EEA", body: ["Some providers are based in the USA. Transfers rely on the EU-US Data Privacy Framework (for certified providers) or the European Commission’s standard contractual clauses."] },
      { h: "Retention", body: [{ list: [
        "Account, student and class data — during participation, then until claims are time-barred (generally 6 years; 3 years for periodic claims).",
        "Payment and accounting records — 5 years from the end of the financial year.",
        "Form requests not followed by enrolment — up to 12 months. Consent-based data — until consent is withdrawn. Technical logs — usually no longer than 30 days.",
      ]}] },
      { h: "Your rights", body: [
        `Access, rectification, erasure, restriction, portability, objection and withdrawal of consent. Contact ${c.email}; a Parent exercises the rights of a Student. You may complain to the Polish supervisory authority (Prezes UODO, ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl).`,
      ]},
      { h: "Providing data", body: ["Voluntary, but necessary for enrolment, accounts, billing and orders."] },
      { h: "Automated decisions", body: ["We make no decisions based solely on automated processing with legal or similarly significant effects. XP, levels and badges are motivational only."] },
      { h: "Security", body: ["HTTPS, hashed passwords, role-based access and a certified payment provider."] },
      { h: "Cookies and changes", body: ["We use strictly necessary cookies only — see the Cookie Policy. We may update this policy; the current version and its effective date are always available in the Service."] },
    ],
  };
}
