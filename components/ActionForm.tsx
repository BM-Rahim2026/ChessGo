"use client";
import { useActionState } from "react";

export type ActionResult = { ok: boolean; message: string } | null;

/** A form whose server action returns a message shown inline (e.g. a one-time password). */
export function ActionForm({ action, children, className }: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <div>
      <form action={formAction} className={className} aria-busy={pending}>{children}</form>
      {state && (
        <p className={`mt-2 rounded p-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{state.message}</p>
      )}
    </div>
  );
}
