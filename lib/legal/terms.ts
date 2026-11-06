import type { Section } from "@/components/LegalPage";
import type { Locale } from "@/lib/i18n/core";
import { OPERATOR as O, nipFormatted } from "./operator";

export type LegalCtx = { email: string; site: string };

const addr = `${O.street}, ${O.postcode} ${O.city}`;

export function terms(locale: Locale, c: LegalCtx): { title: string; intro: string; sections: Section[] } {
  if (locale === "en") return termsEn(c);
  return {
    title: "Regulamin serwisu ChessGo",
    intro: `Niniejszy regulamin określa zasady korzystania z serwisu ChessGo dostępnego pod adresem ${c.site}, w tym zasady zapisów na zajęcia, płatności za zajęcia oraz sprzedaży w sklepie klubowym. Regulamin jest udostępniany nieodpłatnie przed zawarciem umowy w sposób umożliwiający jego pobranie, utrwalenie i wydrukowanie.`,
    sections: [
      { h: "Usługodawca i kontakt", body: [
        `Serwis ChessGo prowadzi ${O.name} z siedzibą w ${O.city} (${addr}), wpisana do Krajowego Rejestru Sądowego – rejestru stowarzyszeń, innych organizacji społecznych i zawodowych, fundacji oraz samodzielnych publicznych zakładów opieki zdrowotnej oraz do rejestru przedsiębiorców – pod numerem KRS ${O.krs}, prowadzonego przez ${O.court}, NIP ${nipFormatted(O.nip)}, REGON ${O.regon} (dalej: „Fundacja” lub „Usługodawca”).`,
        `Fundacja posiada jednostkę terenową: ${O.branch}.`,
        `Kontakt z Usługodawcą: e-mail ${c.email}, adres korespondencyjny: ${addr}.`,
      ]},
      { h: "Definicje", body: [{ list: [
        "Serwis – strona internetowa i aplikacja ChessGo, w tym strony klubów, formularze, panele użytkowników, sklep i strony płatności.",
        "Użytkownik – osoba korzystająca z Serwisu, w szczególności Rodzic, Uczeń, Trener lub osoba odwiedzająca Serwis.",
        "Rodzic – rodzic lub opiekun prawny Ucznia, który zapisuje Ucznia na zajęcia i dokonuje płatności.",
        "Uczeń – dziecko lub osoba niepełnoletnia uczestnicząca w zajęciach szachowych.",
        "Konto – indywidualny dostęp do panelu w Serwisie, chroniony adresem e-mail i hasłem.",
        "Zajęcia – zajęcia szachowe prowadzone przez Fundację w grupach, w tym zajęcia próbne i turnieje klubowe.",
        "Sklep – część Serwisu, w której Rodzic może zamówić produkty klubowe (np. koszulki, zestawy szachowe, książki).",
        "Konsument – osoba fizyczna dokonująca z Fundacją czynności prawnej niezwiązanej bezpośrednio z jej działalnością gospodarczą lub zawodową; postanowienia dotyczące Konsumenta stosuje się także do osoby fizycznej zawierającej umowę bezpośrednio związaną z jej działalnością gospodarczą, gdy umowa nie ma dla niej charakteru zawodowego (art. 38a ustawy o prawach konsumenta).",
      ]}]},
      { h: "Usługi świadczone drogą elektroniczną", body: [
        "Za pośrednictwem Serwisu Fundacja świadczy nieodpłatnie następujące usługi elektroniczne:",
        { list: [
          "udostępnianie informacji o klubie, grupach, planie zajęć, trenerach i aktualnościach;",
          "formularze zgłoszenia na zajęcia próbne oraz zapisu na zajęcia;",
          "prowadzenie Konta (panel Rodzica, Ucznia lub Trenera), w tym podgląd obecności, postępów, odznak, rankingu grupy oraz opłat;",
          "zadania szachowe online („zadanie dnia”) i elementy grywalizacji (punkty XP, poziomy, odznaki, ścieżka ruchów);",
          "składanie zamówień w Sklepie i obsługa płatności online.",
        ]},
        "Umowa o świadczenie usług elektronicznych zostaje zawarta z chwilą rozpoczęcia korzystania z danej usługi i jest zawarta na czas nieoznaczony (w przypadku Konta) albo na czas korzystania z danej funkcji (np. wypełniania formularza). Użytkownik może w każdej chwili zaprzestać korzystania z Serwisu lub zażądać usunięcia Konta, pisząc na adres e-mail Usługodawcy.",
        "Odpłatne są wyłącznie Zajęcia (zgodnie z cennikiem klubu) oraz produkty zamawiane w Sklepie.",
      ]},
      { h: "Wymagania techniczne i zasady korzystania", body: [
        "Do korzystania z Serwisu potrzebne jest urządzenie z dostępem do internetu, aktualna przeglądarka internetowa (np. Chrome, Safari, Firefox, Edge) z włączoną obsługą JavaScript i plików cookies oraz – w przypadku Konta – aktywny adres e-mail.",
        "Zakazane jest dostarczanie przez Użytkownika treści o charakterze bezprawnym, naruszających dobra osobiste innych osób, a także podejmowanie działań zakłócających działanie Serwisu.",
        "Korzystanie z Serwisu wiąże się z typowymi zagrożeniami sieci internet (np. złośliwe oprogramowanie, próby wyłudzenia danych). Fundacja nigdy nie prosi o podanie hasła e-mailem ani telefonicznie.",
      ]},
      { h: "Konto", body: [
        "Konto Rodzica, Ucznia lub Trenera zakłada Fundacja po zapisaniu Ucznia na zajęcia lub nawiązaniu współpracy. Pierwsze logowanie odbywa się hasłem tymczasowym, które należy niezwłocznie zmienić na własne.",
        "Użytkownik zobowiązany jest do zachowania hasła w poufności. Konto Ucznia, który nie ukończył 16 lat, jest tworzone na wniosek i pod nadzorem Rodzica.",
        "Fundacja może zablokować Konto w przypadku rażącego naruszenia Regulaminu, po uprzednim wezwaniu do zaprzestania naruszeń (chyba że naruszenie zagraża bezpieczeństwu Serwisu lub innych osób).",
      ]},
      { h: "Zgłoszenia, zajęcia próbne i zapisy", body: [
        "Wysłanie formularza zgłoszenia na zajęcia próbne lub formularza zapisu nie stanowi zawarcia umowy o udział w Zajęciach. Fundacja kontaktuje się z Rodzicem w celu potwierdzenia terminu oraz grupy.",
        "Zajęcia próbne są bezpłatne, jeżeli klub tak wskazał w Serwisie lub w potwierdzeniu zgłoszenia.",
        "Umowa o udział w Zajęciach zostaje zawarta z chwilą potwierdzenia przez Fundację przyjęcia Ucznia do grupy (np. e-mailem lub przez utworzenie Konta). Szczegółowe zasady organizacyjne zajęć (miejsce, godziny, zasady bezpieczeństwa) Fundacja przekazuje Rodzicowi przed rozpoczęciem zajęć.",
      ]},
      { h: "Opłaty za zajęcia", body: [
        "Wysokość opłat wynika z cennika (abonamentu) przypisanego Uczniowi, udostępnionego w Serwisie, w panelu Rodzica lub w prośbie o płatność. Ceny podawane są w złotych polskich (PLN) i są cenami końcowymi.",
        "Fundacja przekazuje Rodzicowi prośbę o płatność (e-mailem, w panelu Rodzica lub w formie linku) wskazującą kwotę, okres i termin płatności.",
        "Płatności można dokonać: online za pośrednictwem operatora płatności Stripe (BLIK, Przelewy24, karta płatnicza – w zależności od dostępności), przelewem na rachunek wskazany przez Fundację albo w klubie, jeżeli Fundacja dopuszcza taką formę.",
        "Płatności online obsługuje Stripe Payments Europe, Ltd. (Irlandia). Fundacja nie przechowuje danych kart płatniczych.",
      ]},
      { h: "Sklep – zamówienia, płatność i odbiór", body: [
        "Sklep jest dostępny dla Rodziców posiadających Konto. Informacje o produktach nie stanowią oferty w rozumieniu Kodeksu cywilnego, lecz zaproszenie do zawarcia umowy.",
        "Ceny produktów podawane są w złotych polskich i są cenami końcowymi. Rodzic wybiera produkty i rozmiary, a następnie sposób płatności: online (Stripe) lub płatność w klubie przy odbiorze.",
        "Umowa sprzedaży zostaje zawarta z chwilą złożenia zamówienia, co Serwis potwierdza na ekranie i w zakładce „Moje zamówienia”. Złożenie zamówienia z płatnością online wiąże się z obowiązkiem zapłaty.",
        "Zamówienie z płatnością online, które nie zostanie opłacone w ciągu 1 godziny, zostaje anulowane, a towar wraca do sprzedaży.",
        "Produkty odbiera się osobiście w klubie, po otrzymaniu informacji, że zamówienie jest gotowe do odbioru. Fundacja nie prowadzi wysyłki, chyba że uzgodni to indywidualnie z Rodzicem.",
      ]},
      { h: "Prawo odstąpienia od umowy (Konsumenci)", body: [
        "Konsument, który zawarł umowę na odległość, może od niej odstąpić bez podania przyczyny w terminie 14 dni:",
        { list: [
          "w przypadku umowy sprzedaży (Sklep) – od dnia objęcia towaru w posiadanie;",
          "w przypadku umowy o udział w Zajęciach – od dnia zawarcia umowy.",
        ]},
        "Jeżeli na wyraźne żądanie Konsumenta Zajęcia rozpoczęły się przed upływem terminu do odstąpienia, Konsument, który odstępuje od umowy, płaci za Zajęcia zrealizowane do chwili odstąpienia. Prawo odstąpienia nie przysługuje po pełnym wykonaniu usługi, jeżeli Konsument został poinformowany, że po jej spełnieniu utraci prawo odstąpienia (art. 38 ust. 1 pkt 1 ustawy o prawach konsumenta).",
        `Aby odstąpić od umowy, wystarczy wysłać przed upływem terminu jednoznaczne oświadczenie na adres e-mail ${c.email} lub na adres pocztowy Fundacji. Można skorzystać ze wzoru poniżej.`,
        "Fundacja zwraca wszystkie otrzymane płatności niezwłocznie, nie później niż w terminie 14 dni od otrzymania oświadczenia, przy użyciu takiego samego sposobu płatności, jakiego użył Konsument, chyba że Konsument zgodzi się na inny sposób. W przypadku towaru Fundacja może wstrzymać się ze zwrotem do chwili jego otrzymania z powrotem. Konsument zwraca towar w klubie lub na adres Fundacji w terminie 14 dni od odstąpienia; bezpośrednie koszty zwrotu ponosi Konsument.",
        { note: `Wzór formularza odstąpienia od umowy\n\nAdresat: ${O.name}, ${addr}, e-mail: ${c.email}\n\nNiniejszym informuję o moim odstąpieniu od umowy sprzedaży następujących rzeczy / umowy o świadczenie następującej usługi: ……………………\nData zawarcia umowy / odbioru: ……………………\nImię i nazwisko konsumenta: ……………………\nAdres konsumenta: ……………………\nData: ……………………` },
      ]},
      { h: "Reklamacje", body: [
        `Reklamacje dotyczące działania Serwisu, Zajęć lub zamówień ze Sklepu można składać e-mailem na adres ${c.email} lub pisemnie na adres Fundacji. Zalecamy podanie danych kontaktowych, opisu problemu oraz oczekiwanego sposobu rozpatrzenia.`,
        "Fundacja odpowiada na reklamację w terminie 14 dni od jej otrzymania.",
        "W przypadku towaru niezgodnego z umową Konsumentowi przysługują uprawnienia określone w rozdziale 5a ustawy o prawach konsumenta, w tym żądanie naprawy lub wymiany, a w określonych przypadkach – obniżenia ceny lub odstąpienia od umowy.",
      ]},
      { h: "Pozasądowe rozwiązywanie sporów", body: [
        "Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń, w szczególności zwrócić się o pomoc do miejskiego lub powiatowego rzecznika konsumentów albo do Wojewódzkiego Inspektoratu Inspekcji Handlowej w Katowicach. Informacje o tych sposobach są dostępne na stronie Prezesa UOKiK (prawakonsumenta.uokik.gov.pl).",
      ]},
      { h: "Dane osobowe i pliki cookies", body: [
        "Administratorem danych osobowych Użytkowników, Rodziców i Uczniów jest Fundacja. Zasady przetwarzania danych osobowych oraz plików cookies opisują Polityka prywatności oraz Polityka cookies dostępne w Serwisie.",
      ]},
      { h: "Własność intelektualna", body: [
        "Oznaczenia ChessGo, logotyp, układ graficzny oraz treści Serwisu (w tym zadania szachowe i materiały edukacyjne) są chronione prawem. Użytkownik może z nich korzystać wyłącznie na własny użytek w ramach Zajęć i Serwisu.",
      ]},
      { h: "Zmiany Regulaminu i postanowienia końcowe", body: [
        "Fundacja może zmienić Regulamin z ważnych przyczyn, w szczególności zmiany przepisów prawa, zmiany zakresu usług lub względów bezpieczeństwa. Użytkownicy posiadający Konto zostaną poinformowani o zmianie co najmniej 14 dni przed jej wejściem w życie; zamówienia i umowy zawarte wcześniej realizuje się na dotychczasowych zasadach.",
        "W sprawach nieuregulowanych stosuje się przepisy prawa polskiego, w szczególności Kodeksu cywilnego, ustawy o świadczeniu usług drogą elektroniczną oraz ustawy o prawach konsumenta. Postanowienia Regulaminu nie ograniczają praw Konsumentów wynikających z bezwzględnie obowiązujących przepisów.",
        "Regulamin w wersji polskiej jest wersją wiążącą.",
      ]},
    ],
  };
}

function termsEn(c: LegalCtx): { title: string; intro: string; sections: Section[] } {
  return {
    title: "ChessGo Terms of Service",
    intro: `These terms set out the rules for using the ChessGo service at ${c.site}, including enrolment in classes, class fees and purchases in the club shop. This English version is a courtesy translation; the Polish version is binding.`,
    sections: [
      { h: "Service provider and contact", body: [
        `ChessGo is operated by ${O.name}, ${addr}, Poland, entered in the National Court Register (KRS) under number ${O.krs} (registry court: ${O.court}), tax ID (NIP) ${nipFormatted(O.nip)}, REGON ${O.regon} (the “Foundation”). Branch: ${O.branch}.`,
        `Contact: ${c.email}, postal address: ${addr}.`,
      ]},
      { h: "Definitions", body: [{ list: [
        "Service – the ChessGo website and app, including club pages, forms, user panels, the shop and payment pages.",
        "Parent – a parent or legal guardian who enrols a Student and makes payments. Student – a child or minor taking part in chess classes.",
        "Account – personal access to a panel, protected by email and password. Classes – chess classes run by the Foundation, including trial classes and club tournaments.",
        "Consumer – a natural person concluding a contract not directly related to their business or profession (including the cases in art. 38a of the Polish Consumer Rights Act).",
      ]}]},
      { h: "Electronic services", body: [
        "Free of charge, the Foundation provides: club information, trial and registration forms, user accounts (attendance, progress, badges, group ranking, fees), daily chess puzzles and gamification, and shop ordering with online payments. Only Classes (per the club price list) and shop products are paid.",
        "You can stop using the Service at any time or ask for your Account to be deleted by email.",
      ]},
      { h: "Technical requirements and rules", body: [
        "You need an internet-connected device, a current browser with JavaScript and cookies enabled and, for an Account, an email address. Unlawful content and actions that disrupt the Service are prohibited. The Foundation never asks for your password by email or phone.",
      ]},
      { h: "Account", body: [
        "Accounts are created by the Foundation after enrolment. The first sign-in uses a temporary password that must be changed. Keep your password confidential. Accounts of students under 16 are created at the request and under the supervision of a Parent. The Foundation may block an Account for serious breaches after a warning.",
      ]},
      { h: "Trial classes and enrolment", body: [
        "Submitting a trial or registration form does not conclude a contract; the Foundation contacts the Parent to confirm the date and group. Trial classes are free where the club says so. The contract for Classes is concluded when the Foundation confirms the Student’s place in a group.",
      ]},
      { h: "Class fees", body: [
        "Fees follow the price plan assigned to the Student, shown in the Service, the parent panel or the payment request. Prices are in PLN and are final prices. Payment: online via Stripe (BLIK, Przelewy24, card, as available), bank transfer, or at the club if allowed. Online payments are processed by Stripe Payments Europe, Ltd. (Ireland); the Foundation does not store card data.",
      ]},
      { h: "Shop – orders, payment and pickup", body: [
        "The shop is available to Parents with an Account. Prices are in PLN and final. The sales contract is concluded when the order is placed. Unpaid online orders are cancelled after 1 hour. Products are collected at the club; there is no shipping unless agreed individually.",
      ]},
      { h: "Right of withdrawal (Consumers)", body: [
        "Consumers may withdraw from a distance contract within 14 days without giving a reason: for goods – from receiving them; for Classes – from concluding the contract. If, at the Consumer’s express request, Classes started before the end of that period, the Consumer pays for Classes provided until withdrawal; the right expires once the service has been fully performed.",
        `Send a clear statement to ${c.email} or the Foundation’s address (you may use the model form in the Polish version). Refunds are made within 14 days using the same payment method; for goods, the refund may be withheld until the goods are returned. Direct return costs are borne by the Consumer.`,
      ]},
      { h: "Complaints", body: [
        `Send complaints to ${c.email} or by post. The Foundation replies within 14 days. For goods not in conformity with the contract, Consumers have the rights set out in chapter 5a of the Polish Consumer Rights Act (repair, replacement, price reduction or withdrawal).`,
      ]},
      { h: "Out-of-court dispute resolution", body: [
        "Consumers may seek help from a municipal or district consumer ombudsman or the Provincial Inspectorate of Trade Inspection in Katowice; see prawakonsumenta.uokik.gov.pl.",
      ]},
      { h: "Personal data and cookies", body: ["The Foundation is the data controller. See the Privacy Policy and Cookie Policy."] },
      { h: "Intellectual property", body: ["The ChessGo name, logo, design and content (including puzzles) are protected and may be used only for personal purposes within the Classes and the Service."] },
      { h: "Changes and final provisions", body: [
        "The Foundation may change these terms for important reasons, notifying Account holders at least 14 days in advance. Polish law applies; mandatory consumer rights are not limited. The Polish version is binding.",
      ]},
    ],
  };
}
