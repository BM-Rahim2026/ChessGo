"use client";
import { useFormStatus } from "react-dom";

/** Submit button that shows it is working (disabled + label) while the form is being sent. */
export function SubmitButton({ children, pending, className = "btn" }: { children: React.ReactNode; pending: string; className?: string }) {
  const { pending: busy } = useFormStatus();
  return <button className={`${className} disabled:opacity-70`} disabled={busy} aria-busy={busy}>{busy ? pending : children}</button>;
}
