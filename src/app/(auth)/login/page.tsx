"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernameOrEmail, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Try again.");
      return;
    }
    router.push(searchParams.get("next") ?? "/mail/inbox");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="usernameOrEmail" className="block text-sm mb-1 text-ink">
          Username or email
        </label>
        <input
          id="usernameOrEmail"
          type="text"
          autoComplete="username"
          required
          value={usernameOrEmail}
          onChange={(e) => setUsernameOrEmail(e.target.value)}
          className="w-full rounded border border-line bg-white px-3 py-2 text-sm focus-visible:outline-accent"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm mb-1 text-ink">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-line bg-white px-3 py-2 text-sm focus-visible:outline-accent"
        />
      </div>

      {error && <p className="text-sm text-flag" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-accent text-white text-sm font-medium py-2.5 hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl mb-1 text-ink">Postbox</h1>
        <p className="text-muted text-sm mb-8">Sign in to your mailbox</p>

        <Suspense fallback={<div>Loading...</div>}>
          <LoginForm />
        </Suspense>

        <p className="text-sm text-muted mt-6">
          New here?{" "}
          <Link href="/signup" className="text-accent underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
