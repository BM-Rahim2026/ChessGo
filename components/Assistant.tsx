"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Admin AI assistant: a slide-over chat available on every admin page.
// Open it from anywhere with: window.dispatchEvent(new CustomEvent("cg-assistant", { detail: { text } }))

type Item =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | { role: "tool"; id?: string; label: string; ok?: boolean; pending?: boolean; link?: string; error?: string };
type ChatRow = { id: string; title: string; updatedAt: string };
type Ev =
  | { t: "chat"; id: string; title: string }
  | { t: "tool"; id: string; name: string; label: string }
  | { t: "tool_done"; id: string; ok: boolean; link?: string; error?: string }
  | { t: "text"; text: string }
  | { t: "error"; message: string }
  | { t: "done" };

const SUGGESTIONS = [
  "Stwórz 3 zadania „mat w 1” dla początkujących",
  "Znajdź 5 łatwych zadań na widełki w bazie Lichess",
  "Kto nie zapłacił w tym miesiącu?",
  "Jaka była frekwencja w ostatnim miesiącu?",
  "Napisz aktualność o zbliżającym się turnieju",
  "Pokaż nowe zgłoszenia i zaproponuj grupy",
];

/** **bold** inside a line, rendered without HTML injection. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}</>;
}
function Formatted({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length} className="my-1 list-disc space-y-0.5 pl-5">{list.map((l, i) => <li key={i}><Inline text={l} /></li>)}</ul>);
    list = [];
  };
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (m) { list.push(m[1]); continue; }
    flush();
    if (line.trim()) blocks.push(<p key={blocks.length} className="my-1"><Inline text={line.replace(/^#+\s*/, "")} /></p>);
  }
  flush();
  return <div className="break-words">{blocks}</div>;
}

export function Assistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const changed = useRef(false);

  const loadList = useCallback(async () => {
    const r = await fetch("/api/admin/assistant", { cache: "no-store" });
    if (!r.ok) return;
    const j = (await r.json()) as { enabled: boolean; chats: ChatRow[] };
    setEnabled(j.enabled);
    setChats(j.chats);
  }, []);

  useEffect(() => {
    if (open) { loadList(); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open, loadList]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [items, busy]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setItems((x) => [...x, { role: "user", text }]);
    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, text }),
      });
      if (!res.ok || !res.body) {
        setItems((x) => [...x, { role: "assistant", text: res.status === 501 ? "Asystent nie jest jeszcze skonfigurowany (brak ANTHROPIC_API_KEY)." : "Nie udało się połączyć z asystentem." }]);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as Ev;
          if (ev.t === "chat") setChatId(ev.id);
          else if (ev.t === "text") setItems((x) => [...x, { role: "assistant", text: ev.text }]);
          else if (ev.t === "tool") setItems((x) => [...x, { role: "tool", id: ev.id, label: ev.label, pending: true }]);
          else if (ev.t === "tool_done") {
            if (ev.ok && ev.link) changed.current = true;
            setItems((x) => x.map((it) => (it.role === "tool" && it.id === ev.id ? { ...it, pending: false, ok: ev.ok, link: ev.link, error: ev.error } : it)));
          } else if (ev.t === "error") setItems((x) => [...x, { role: "assistant", text: `⚠️ ${ev.message}` }]);
        }
      }
    } catch {
      setItems((x) => [...x, { role: "assistant", text: "⚠️ Połączenie zostało przerwane. Spróbuj ponownie." }]);
    } finally {
      setBusy(false);
      if (changed.current) { changed.current = false; router.refresh(); }
      loadList();
    }
  }, [busy, chatId, router, loadList]);

  // Open (and optionally send) from anywhere, e.g. the dashboard card.
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const text = (e as CustomEvent<{ text?: string }>).detail?.text;
      if (text) { setChatId(null); setItems([]); setTimeout(() => send(text), 0); }
    };
    window.addEventListener("cg-assistant", onOpen);
    return () => window.removeEventListener("cg-assistant", onOpen);
  }, [send]);

  const openChat = async (id: string) => {
    setShowHistory(false);
    const r = await fetch(`/api/admin/assistant?chat=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!r.ok) return;
    const j = (await r.json()) as { id: string; items: Item[] };
    setChatId(j.id);
    setItems(j.items);
  };
  const newChat = () => { setChatId(null); setItems([]); setShowHistory(false); inputRef.current?.focus(); };
  const removeChat = async (id: string) => {
    await fetch(`/api/admin/assistant?chat=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (id === chatId) newChat();
    loadList();
  };

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex min-h-[48px] items-center gap-2 rounded-full bg-forest px-5 font-semibold text-white shadow-lg hover:bg-forest/90"
          aria-label="Otwórz asystenta AI">
          <span aria-hidden>✨</span> Asystent
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={() => setOpen(false)}>
          <aside role="dialog" aria-label="Asystent AI" onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-[520px] flex-col bg-cream shadow-2xl">
            <header className="flex items-center gap-2 border-b border-ink/10 bg-white px-4 py-3">
              <span aria-hidden className="text-xl">✨</span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-semibold text-forest">Asystent ChessGo</div>
                <div className="truncate text-xs text-ink-soft">Zadania, raporty, aktualności i więcej</div>
              </div>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setShowHistory((v) => !v)}>Historia</button>
              <button type="button" className="btn-secondary btn-sm" onClick={newChat}>Nowa</button>
              <button type="button" className="ml-1 rounded-control px-2 py-1 text-xl leading-none text-ink-soft hover:bg-mint" onClick={() => setOpen(false)} aria-label="Zamknij">×</button>
            </header>

            {showHistory && (
              <div className="max-h-72 overflow-y-auto border-b border-ink/10 bg-white">
                {chats.length === 0 ? <p className="px-4 py-3 text-sm text-ink-soft">Brak wcześniejszych rozmów.</p> : chats.map((c) => (
                  <div key={c.id} className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-mint ${c.id === chatId ? "bg-mint" : ""}`}>
                    <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => openChat(c.id)}>{c.title}</button>
                    <span className="shrink-0 text-xs text-ink-soft">{new Date(c.updatedAt).toLocaleDateString("pl-PL")}</span>
                    <button type="button" className="shrink-0 px-1 text-ink-soft hover:text-red-700" onClick={() => removeChat(c.id)} aria-label="Usuń rozmowę">🗑</button>
                  </div>
                ))}
              </div>
            )}

            <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {enabled === false && (
                <div className="rounded-card border-l-4 border-go bg-white p-3 text-sm">
                  <b>Asystent nie jest jeszcze włączony.</b> Dodaj klucz <code>ANTHROPIC_API_KEY</code> w ustawieniach Vercel i wdroż ponownie aplikację.
                </div>
              )}
              {items.length === 0 && (
                <div>
                  <p className="text-ink">Cześć! W czym mogę pomóc? Mogę tworzyć zadania szachowe, sprawdzać płatności i frekwencję, pisać aktualności i wiadomości do rodziców.</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" disabled={!enabled || busy} onClick={() => send(s)}
                        className="rounded-control border border-ink/10 bg-white px-3 py-2 text-left text-sm text-forest hover:bg-mint disabled:opacity-50">{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {items.map((it, i) => it.role === "user" ? (
                <div key={i} className="ml-8 rounded-card rounded-br-sm bg-forest px-3 py-2 text-[15px] text-white"><span className="whitespace-pre-wrap break-words">{it.text}</span></div>
              ) : it.role === "assistant" ? (
                <div key={i} className="mr-4 rounded-card rounded-bl-sm bg-white px-3 py-2 text-[15px] text-ink shadow-sm"><Formatted text={it.text} /></div>
              ) : (
                <div key={i} className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                  <span className={`pill ${it.pending ? "" : it.ok === false ? "bg-red-50 text-red-800" : "pill-green"}`}>
                    {it.pending ? "⏳" : it.ok === false ? "⚠" : "✓"} {it.label}
                  </span>
                  {it.link && <a href={it.link} className="font-semibold text-forest underline">Otwórz →</a>}
                </div>
              ))}
              {busy && <div className="flex items-center gap-2 text-sm text-ink-soft"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-chess" /> Asystent pracuje…</div>}
            </div>

            <form className="border-t border-ink/10 bg-white p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <div className="flex items-end gap-2">
                <textarea ref={inputRef} className="input max-h-40 min-h-[48px] flex-1 resize-none" rows={2} value={input}
                  placeholder="Napisz, czego potrzebujesz…" maxLength={4000} disabled={enabled === false}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
                <button className="btn" disabled={busy || !input.trim() || enabled === false}>Wyślij</button>
              </div>
              <p className="mt-1 text-[11px] text-ink-soft">Asystent może się mylić — sprawdź utworzone treści. Nie usuwa danych i nie wysyła e-maili.</p>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}

/** Dashboard card: a prompt box that opens the assistant with the text. */
export function AssistantCard() {
  const [text, setText] = useState("");
  const go = (t: string) => window.dispatchEvent(new CustomEvent("cg-assistant", { detail: { text: t } }));
  return (
    <div className="card mb-6 border-l-4 border-chess">
      <div className="flex items-center gap-2"><span aria-hidden className="text-xl">✨</span><h2 className="h2">Asystent AI</h2></div>
      <p className="muted mt-1 text-sm">Poproś o zadania szachowe, raport frekwencji, listę zaległych płatności, aktualność lub wiadomość do rodziców.</p>
      <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { go(text); setText(""); } }}>
        <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="np. Stwórz 5 zadań „mat w 2” na przyszły tydzień" maxLength={4000} />
        <button className="btn">Zapytaj</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {SUGGESTIONS.slice(0, 3).map((s) => <button key={s} type="button" className="pill hover:bg-mint" onClick={() => go(s)}>{s}</button>)}
      </div>
    </div>
  );
}
