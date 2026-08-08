"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, fetchRateConfig } from "@/lib/api";
import { clearOperatorToken, updateRateConfig } from "@/lib/operator";
import OperatorShell from "@/components/operator/OperatorShell";
import { useAsyncEffect } from "@/lib/useAsyncEffect";

const formatNaira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export default function OperatorRatesPage() {
  const router = useRouter();
  const [washAndFold, setWashAndFold] = useState("");
  const [ironOnly, setIronOnly] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const config = await fetchRateConfig();
      setError(null);
      setWashAndFold(String(config.wash_and_fold));
      setIronOnly(String(config.iron_only));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearOperatorToken();
        router.replace("/operator/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not load rates.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useAsyncEffect(() => load(), [load]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setNotice(null);
    const wash = Number(washAndFold);
    const iron = Number(ironOnly);
    if (!Number.isInteger(wash) || wash < 1 || !Number.isInteger(iron) || iron < 1) {
      setError("Rates must be whole naira amounts of at least 1.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateRateConfig({ wash_and_fold: wash, iron_only: iron });
      setWashAndFold(String(updated.wash_and_fold));
      setIronOnly(String(updated.iron_only));
      setNotice("Rates saved.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearOperatorToken();
        router.replace("/operator/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not save rates.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-base text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none";

  return (
    <OperatorShell>
      <div className="space-y-4">
        <h2 className="font-display text-lg font-bold">Pricing</h2>
        <p className="text-sm text-ink-muted">
          These are the rates charged per item. Existing orders keep the rate they were booked at.
        </p>

        {loading ? (
          <p className="py-8 text-center text-sm text-ink-muted">Loading rates…</p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {error ? (
              <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
                {notice}
              </p>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">
                Wash &amp; Fold <span className="text-primary">*</span>
              </span>
              <span className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
                  ₦
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={washAndFold}
                  onChange={(e) => setWashAndFold(e.target.value)}
                  className={`${inputClass} pl-8`}
                />
              </span>
              <span className="mt-1 block text-xs text-ink-muted">
                Per item · currently {washAndFold ? formatNaira(Number(washAndFold)) : "—"}
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">
                Iron Only <span className="text-primary">*</span>
              </span>
              <span className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
                  ₦
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={ironOnly}
                  onChange={(e) => setIronOnly(e.target.value)}
                  className={`${inputClass} pl-8`}
                />
              </span>
              <span className="mt-1 block text-xs text-ink-muted">
                Per item · currently {ironOnly ? formatNaira(Number(ironOnly)) : "—"}
              </span>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 w-full rounded-lg bg-primary px-6 font-bold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save rates"}
            </button>
          </form>
        )}
      </div>
    </OperatorShell>
  );
}
