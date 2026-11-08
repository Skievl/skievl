import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-extrabold">Join the Exchange</h1>
        <p className="mt-1 text-sm text-muted">One account to buy and sell gear locally.</p>
        <SignupForm next={next ?? "/"} />
      </div>
    </div>
  );
}
