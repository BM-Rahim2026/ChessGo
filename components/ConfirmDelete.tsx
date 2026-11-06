"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";

type Labels = { open: string; title: string; typeToConfirm: string; confirm: string; cancel: string };

function Submit({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-danger bg-red-700 text-white hover:bg-red-800 disabled:opacity-40" disabled={disabled || pending}>{pending ? "…" : label}</button>;
}

/**
 * Two-step delete: the first click opens a warning panel, and the delete button only
 * unlocks after typing the exact name. The server action re-checks the typed name.
 */
export function ConfirmDelete({ action, id, name, warnings, labels }: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  name: string;
  warnings: string[];
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const match = typed.trim().toLowerCase() === name.trim().toLowerCase();
  if (!open) return <button type="button" className="btn-danger" onClick={() => setOpen(true)}>{labels.open}</button>;
  return (
    <form action={action} role="alertdialog" aria-label={labels.title} className="w-full rounded-card border-2 border-red-300 bg-red-50 p-4 text-sm text-red-900">
      <input type="hidden" name="id" value={id} />
      <p className="mb-2 font-semibold">{labels.title}</p>
      <ul className="mb-3 list-disc space-y-1 pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      <label className="block">
        <span className="mb-1 block">{labels.typeToConfirm} <b className="break-all">{name}</b></span>
        <input className="input bg-white" name="confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Submit disabled={!match} label={labels.confirm} />
        <button type="button" className="btn-secondary" onClick={() => { setOpen(false); setTyped(""); }}>{labels.cancel}</button>
      </div>
    </form>
  );
}
