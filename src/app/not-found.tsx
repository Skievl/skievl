import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <p className="text-sm font-bold tracking-widest text-muted">404</p>
      <h1 className="mt-2 text-3xl font-extrabold">Off-piste!</h1>
      <p className="mt-2 text-ink-soft">We couldn&apos;t find that page. It may have sold or been removed.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/search" className="btn-primary">Browse gear</Link>
        <Link href="/" className="btn-secondary">Home</Link>
      </div>
    </div>
  );
}
