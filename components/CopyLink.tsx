"use client";
import { useState } from "react";

/** Copies a URL to the clipboard (falls back to a prompt on old browsers). */
export function CopyLink({ url, label, done }: { url: string; label: string; done: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn-secondary btn-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(url); setOk(true); setTimeout(() => setOk(false), 2000); }
      catch { window.prompt(label, url); }
    }}>{ok ? done : label}</button>
  );
}
