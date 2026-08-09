"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearOperatorToken, useOperatorAuth } from "@/lib/operator";

export default function OperatorShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const authed = useOperatorAuth();

  if (!authed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 text-center">
        <p className="font-display text-xl font-semibold">Operator access only.</p>
        <p className="mt-2 text-sm text-ink-muted">Log in to manage orders.</p>
        <Link
          href="/operator/login"
          className="mt-6 rounded-lg bg-primary px-6 py-3 font-bold text-white hover:bg-primary-dark"
        >
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Ace Laundry</h1>
          <p className="text-xs text-ink-muted">Operator console</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/operator"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              pathname === "/operator"
                ? "bg-primary text-white"
                : "text-ink hover:bg-surface"
            }`}
          >
            Orders
          </Link>
          <Link
            href="/operator/rates"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              pathname.startsWith("/operator/rates")
                ? "bg-primary text-white"
                : "text-ink hover:bg-surface"
            }`}
          >
            Rates
          </Link>
          <Link
            href="/operator/settings"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              pathname.startsWith("/operator/settings")
                ? "bg-primary text-white"
                : "text-ink hover:bg-surface"
            }`}
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={() => {
              clearOperatorToken();
              router.replace("/operator/login");
            }}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/10"
          >
            Log out
          </button>
        </div>
      </header>
      {children}
    </main>
  );
}
