import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-extrabold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to buy, sell, and save gear.</p>
        {error && <p className="mt-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">That sign-in link is invalid or expired.</p>}
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
