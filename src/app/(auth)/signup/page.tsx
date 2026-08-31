"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const MAIL_DOMAIN = process.env.NEXT_PUBLIC_MAIL_DOMAIN ?? "mydomain.com";

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.toLowerCase(), displayName, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Try again.");
      return;
    }
    router.push("/mail/inbox");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl mb-1 text-ink">Postbox</h1>
        <p className="text-muted text-sm mb-8">Create your address</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm mb-1 text-ink">
              Username
            </label>
            <div className="flex items-stretch rounded border border-line bg-white overflow-hidden focus-within:outline focus-within:outline-2 focus-within:outline-accent">
              <input
                id="username"
                type="text"
                required
                minLength={3}
                pattern="[a-z0-9._-]+"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 px-3 py-2 text-sm outline-none"
                placeholder="alice"
              />
              <span className="px-3 py-2 text-sm text-muted bg-accentSoft border-l border-line">
                @{MAIL_DOMAIN}
              </span>
            </div>
          </div>
          <div>
            <label htmlFor="displayName" className="block text-sm mb-1 text-ink">
              Your name
            </label>
            <input
              id="displayName"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-line bg-white px-3 py-2 text-sm focus-visible:outline-accent"
            />
            <p className="text-xs text-muted mt-1">At least 8 characters.</p>
          </div>

          {error && <p className="text-sm text-flag" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-accent text-white text-sm font-medium py-2.5 hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-muted mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-accent underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
