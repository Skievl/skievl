"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <h1 className="text-3xl font-extrabold">Something went wrong</h1>
      <p className="mt-2 text-ink-soft">Please try again. If it keeps happening, email support@skievl.com{error.digest ? ` and mention code ${error.digest}` : ""}.</p>
      <button className="btn-primary mt-6" onClick={reset}>Try again</button>
    </div>
  );
}
