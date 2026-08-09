"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  clearOperatorToken,
  fetchOperatorSettings,
  updateOperatorSettings,
  sendWhatsAppTest,
  type OperatorSettings,
} from "@/lib/operator";
import OperatorShell from "@/components/operator/OperatorShell";
import { useAsyncEffect } from "@/lib/useAsyncEffect";

const normalizePhone = (raw: string) => raw.replace(/[\s-]/g, "").trim();
const isValidPhone = (phone: string) => /^0\d{10}$/.test(phone);

export default function OperatorSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<OperatorSettings>({
    business_phone: "",
    whatsapp_test_recipient: "",
    whatsapp_template_name: "",
    whatsapp_template_language: "en",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const loaded = await fetchOperatorSettings();
      setError(null);
      setSettings({
        business_phone: loaded.business_phone,
        whatsapp_test_recipient: loaded.whatsapp_test_recipient,
        whatsapp_template_name: loaded.whatsapp_template_name,
        whatsapp_template_language: loaded.whatsapp_template_language || "en",
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearOperatorToken();
        router.replace("/operator/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useAsyncEffect(() => load(), [load]);

  function handleAuthError(err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      clearOperatorToken();
      router.replace("/operator/login");
      return true;
    }
    return false;
  }

  function setField(key: keyof OperatorSettings, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setNotice(null);
    const normalized = normalizePhone(settings.business_phone);
    if (!isValidPhone(normalized)) {
      setError("Enter a valid 11-digit business number starting with 0.");
      return;
    }
    const recipient = normalizePhone(settings.whatsapp_test_recipient);
    if (recipient && !isValidPhone(recipient)) {
      setError("Enter a valid 11-digit WhatsApp test number starting with 0.");
      return;
    }
    const language = settings.whatsapp_template_language.trim() || "en";
    setSaving(true);
    try {
      const updated = await updateOperatorSettings({
        business_phone: normalized,
        whatsapp_test_recipient: recipient,
        whatsapp_template_name: settings.whatsapp_template_name.trim(),
        whatsapp_template_language: language,
      });
      setSettings({ ...updated, whatsapp_template_language: updated.whatsapp_template_language || "en" });
      setNotice("Settings saved.");
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestWhatsApp() {
    if (testing) return;
    setError(null);
    setNotice(null);
    if (!settings.whatsapp_test_recipient.trim()) {
      setError("Enter a WhatsApp test recipient number first.");
      return;
    }
    if (!settings.whatsapp_template_name.trim()) {
      setError("Enter the WhatsApp template name first.");
      return;
    }
    setTesting(true);
    try {
      await sendWhatsAppTest();
      setNotice("Test message sent. Check the recipient's WhatsApp.");
    } catch (err) {
      if (handleAuthError(err)) return;
      setError(err instanceof ApiError ? err.message : "Could not send the test message.");
    } finally {
      setTesting(false);
    }
  }

  const inputClass =
    "w-full min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-base text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none";

  return (
    <OperatorShell>
      <div className="space-y-4">
        <h2 className="font-display text-lg font-bold">Settings</h2>
        <p className="text-sm text-ink-muted">
          Business contact details and WhatsApp notification setup.
        </p>

        {loading ? (
          <p className="py-8 text-center text-sm text-ink-muted">Loading settings…</p>
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

            <div className="space-y-4 rounded-lg border border-line p-4">
              <div>
                <h3 className="font-display text-base font-bold">Business contact</h3>
                <p className="text-xs text-ink-muted">
                  Shown to customers on the Call / WhatsApp buttons.
                </p>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">
                  Business phone / WhatsApp number <span className="text-primary">*</span>
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={settings.business_phone}
                  onChange={(e) => setField("business_phone", e.target.value.replace(/[^\d\s-]/g, ""))}
                  placeholder="0903 061 4990"
                  className={inputClass}
                />
              </label>
            </div>

            <div className="space-y-4 rounded-lg border border-line p-4">
              <div>
                <h3 className="font-display text-base font-bold">WhatsApp notifications</h3>
                <p className="text-xs text-ink-muted">
                  Used to send order updates via an approved Meta template (bypasses the 24-hour
                  customer-service window).
                </p>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">
                  Test recipient number
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  value={settings.whatsapp_test_recipient}
                  onChange={(e) =>
                    setField("whatsapp_test_recipient", e.target.value.replace(/[^\d\s-]/g, ""))
                  }
                  placeholder="0803 000 0000"
                  className={inputClass}
                />
                <span className="mt-1 block text-xs text-ink-muted">
                  Receives test messages. Must be added to the allowlist in Meta WhatsApp Manager.
                </span>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">
                  Template name
                </span>
                <input
                  type="text"
                  value={settings.whatsapp_template_name}
                  onChange={(e) => setField("whatsapp_template_name", e.target.value)}
                  placeholder="e.g. laundry_update"
                  className={inputClass}
                />
                <span className="mt-1 block text-xs text-ink-muted">
                  The approved template name shown in Meta WhatsApp Manager.
                </span>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">
                  Template language
                </span>
                <input
                  type="text"
                  maxLength={5}
                  value={settings.whatsapp_template_language}
                  onChange={(e) => setField("whatsapp_template_language", e.target.value)}
                  placeholder="en"
                  className={inputClass}
                />
                <span className="mt-1 block text-xs text-ink-muted">
                  Template language code (e.g. en, fr, en_GB).
                </span>
              </label>
              <button
                type="button"
                onClick={handleTestWhatsApp}
                disabled={testing}
                className="min-h-11 w-full rounded-lg border border-primary px-6 font-bold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing ? "Sending…" : "Send test WhatsApp message"}
              </button>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="min-h-11 w-full rounded-lg bg-primary px-6 font-bold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
        )}
      </div>
    </OperatorShell>
  );
}
