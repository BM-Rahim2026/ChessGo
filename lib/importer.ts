// CSV import of students + parents (e.g. an export from SportBM). Pure functions, usable on client and server.

export const FIELDS = {
  studentFirst: "Student first name",
  studentLast: "Student last name",
  studentName: "Student full name",
  birthDate: "Birth date",
  group: "Group",
  status: "Status (active/inactive)",
  joinedAt: "Joined date",
  parentFirst: "Parent first name",
  parentLast: "Parent last name",
  parentName: "Parent full name",
  parentEmail: "Parent email",
  parentPhone: "Parent phone",
  notes: "Notes",
} as const;
export type Field = keyof typeof FIELDS;
export type Mapping = Partial<Record<Field, number>>; // field → column index

const ALIASES: Record<Field, string[]> = {
  studentFirst: ["firstname", "first", "givenname", "studentfirstname", "childfirstname", "athletefirstname", "memberfirstname", "vorname", "prenom", "nombre"],
  studentLast: ["lastname", "last", "surname", "familyname", "studentlastname", "childlastname", "athletelastname", "memberlastname", "nachname", "familienname", "nom", "apellido"],
  studentName: ["name", "fullname", "student", "studentname", "child", "childname", "athlete", "athletename", "member", "membername", "participant", "kind", "mitglied", "teilnehmer", "schuler", "schueler", "spieler", "player"],
  birthDate: ["birthdate", "dateofbirth", "dob", "birthday", "born", "geburtsdatum", "geburtstag", "geboren", "datedenaissance"],
  group: ["group", "groupname", "class", "classname", "team", "squad", "course", "level", "training", "program", "programme", "gruppe", "kurs", "klasse", "mannschaft"],
  status: ["status", "active", "memberstatus", "membershipstatus", "state", "aktiv"],
  joinedAt: ["joined", "joindate", "joinedat", "datejoined", "startdate", "start", "registrationdate", "registered", "membersince", "signupdate", "createdat", "created", "eintritt", "eintrittsdatum", "mitgliedseit", "anmeldedatum"],
  parentFirst: ["parentfirstname", "guardianfirstname", "contactfirstname", "motherfirstname", "fatherfirstname", "elternvorname"],
  parentLast: ["parentlastname", "guardianlastname", "contactlastname", "motherlastname", "fatherlastname", "elternnachname"],
  parentName: ["parent", "parentname", "parents", "guardian", "guardianname", "contact", "contactname", "contactperson", "mother", "father", "eltern", "elternteil", "erziehungsberechtigter", "ansprechpartner", "kontakt"],
  parentEmail: ["email", "emailaddress", "mail", "parentemail", "guardianemail", "contactemail", "parentmail", "emailadresse"],
  parentPhone: ["phone", "phonenumber", "mobile", "mobilephone", "cell", "cellphone", "tel", "telephone", "parentphone", "guardianphone", "contactphone", "handy", "telefon", "mobil", "telefonnummer"],
  notes: ["notes", "note", "comment", "comments", "remarks", "info", "bemerkung", "bemerkungen", "notiz", "notizen", "anmerkung"],
};

const norm = (h: string) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");

/** RFC-4180-ish CSV parser. Detects ; , or tab as the delimiter from the header line. */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && cell === "") q = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

export function autoMap(headers: string[]): Mapping {
  const m: Mapping = {};
  const used = new Set<number>();
  const keys = headers.map(norm);
  for (const field of Object.keys(ALIASES) as Field[]) {
    for (const alias of ALIASES[field]) {
      const i = keys.findIndex((k, idx) => !used.has(idx) && k === alias);
      if (i >= 0) { m[field] = i; used.add(i); break; }
    }
  }
  // Fuzzy second pass: header contains an alias (e.g. "Parent E-Mail Address")
  for (const field of Object.keys(ALIASES) as Field[]) {
    if (m[field] !== undefined) continue;
    const i = keys.findIndex((k, idx) => !used.has(idx) && ALIASES[field].some((a) => a.length > 3 && k.includes(a)));
    if (i >= 0) { m[field] = i; used.add(i); }
  }
  return m;
}

/** Accepts 2015-03-04, 04.03.2015, 04/03/2015 (day first), 3/14/2015 (US, detected), 04.03.15, and Excel serials. */
export function parseDate(v: string): string | null {
  v = v.trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    let [a, b, y] = [+m[1], +m[2], +m[3]];
    if (y < 100) y += y <= new Date().getFullYear() % 100 ? 2000 : 1900;
    if (b > 12 && a <= 12) [a, b] = [b, a]; // US month/day
    return iso(y, b, a);
  }
  if (/^\d{5}$/.test(v)) { // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}
function iso(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

const INACTIVE = ["inactive", "no", "0", "false", "left", "former", "cancelled", "canceled", "ended", "archived", "inaktiv", "ausgetreten", "gekundigt", "gekuendigt", "nein", "ex"];

function splitName(full: string): [string, string] {
  const parts = full.replace(/\s+/g, " ").trim();
  if (parts.includes(",")) { const [last, first] = parts.split(",").map((s) => s.trim()); return [first ?? "", last ?? ""]; } // "Doe, Jane"
  const i = parts.lastIndexOf(" ");
  return i < 0 ? [parts, ""] : [parts.slice(0, i), parts.slice(i + 1)];
}

export type ImportRow = {
  line: number;
  studentFirst: string; studentLast: string; birthDate: string | null;
  group: string | null; active: boolean; joinedAt: string | null;
  parentFirst: string; parentLast: string; parentEmail: string | null; parentPhone: string | null;
  notes: string | null;
  errors: string[]; warnings: string[];
};

export function normalizeRows(rows: string[][], mapping: Mapping): ImportRow[] {
  const get = (r: string[], f: Field) => (mapping[f] !== undefined ? (r[mapping[f]!] ?? "").trim() : "");
  return rows.slice(1).map((r, i) => {
    const errors: string[] = [], warnings: string[] = [];
    let first = get(r, "studentFirst"), last = get(r, "studentLast");
    if ((!first || !last) && get(r, "studentName")) {
      const [f, l] = splitName(get(r, "studentName"));
      first ||= f; last ||= l;
    }
    if (!first) errors.push("missing student name");
    if (!last) warnings.push("no last name");

    const rawBirth = get(r, "birthDate"), birthDate = parseDate(rawBirth);
    if (rawBirth && !birthDate) warnings.push(`birth date "${rawBirth}" not understood`);
    const rawJoined = get(r, "joinedAt"), joinedAt = parseDate(rawJoined);
    if (rawJoined && !joinedAt) warnings.push(`joined date "${rawJoined}" not understood`);

    let pFirst = get(r, "parentFirst"), pLast = get(r, "parentLast");
    if ((!pFirst || !pLast) && get(r, "parentName")) {
      const [f, l] = splitName(get(r, "parentName"));
      pFirst ||= f; pLast ||= l;
    }
    let email: string | null = get(r, "parentEmail").toLowerCase().split(/[;,\s]+/)[0] || null;
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { warnings.push(`email "${email}" looks invalid, skipped`); email = null; }
    if (!email && (pFirst || pLast)) warnings.push("parent has no email, not linked");

    const status = norm(get(r, "status"));
    return {
      line: i + 2, studentFirst: first, studentLast: last, birthDate, group: get(r, "group") || null,
      active: !INACTIVE.includes(status), joinedAt,
      parentFirst: pFirst || "Parent", parentLast: pLast || last, parentEmail: email, parentPhone: get(r, "parentPhone") || null,
      notes: get(r, "notes") || null, errors, warnings,
    };
  });
}
