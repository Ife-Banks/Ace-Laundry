"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { operatorLogin } from "@/lib/operator";

export default function OperatorLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await operatorLogin(password);
      router.replace("/operator");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="font-display text-2xl font-bold">Operator log in</h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">Enter the operator password to continue.</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <label htmlFor="password" className="block text-sm font-semibold text-ink">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-base text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
        />
        {error ? (
          <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full min-h-11 rounded-lg bg-primary px-6 font-bold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </main>
  );
}
