"use client";
import { useEffect, useState } from "react";
// Friendly fallback for unexpected errors — most often a page opened before an update.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Same first render on server and client (Polish), then switch after mount to avoid hydration mismatches.
  const [pl, setPl] = useState(true);
  useEffect(() => { setPl(document.documentElement.lang !== "en"); }, []);
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <img src="/brand/crown-c.png" alt="" width={44} height={64} style={{ height: 64, width: "auto" }} />
      <h1 className="h1 mt-4">{pl ? "Coś poszło nie tak" : "Something went wrong"}</h1>
      <p className="muted mt-2">{pl ? "Strona mogła się zaktualizować w międzyczasie. Odśwież ją i spróbuj ponownie." : "The app may have been updated in the meantime. Reload the page and try again."}</p>
      <div className="mt-6 flex gap-2">
        <button className="btn btn-lg" onClick={() => window.location.reload()}>{pl ? "Odśwież stronę" : "Reload page"}</button>
        <button className="btn-secondary btn-lg" onClick={() => reset()}>{pl ? "Spróbuj ponownie" : "Try again"}</button>
      </div>
    </main>
  );
}
