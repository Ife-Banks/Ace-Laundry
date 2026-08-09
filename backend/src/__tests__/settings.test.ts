import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { env } from "../lib/env.js";
import {
  getBusinessPhone,
  setBusinessPhone,
  SETTING_BUSINESS_PHONE,
  getWhatsappTestRecipient,
  setWhatsappTestRecipient,
  getWhatsappTemplateName,
  setWhatsappTemplateName,
  getWhatsappTemplateLanguage,
  setWhatsappTemplateLanguage,
} from "../services/settingsService.js";

// In-memory stand-in for the Setting table.
function makeDb() {
  const rows = new Map<string, string>();
  return {
    rows,
    db: {
      setting: {
        findUnique: async ({ where }: { where: { key: string } }) =>
          rows.has(where.key) ? { key: where.key, value: rows.get(where.key)! } : null,
        upsert: async ({
          where,
          update,
          create,
        }: {
          where: { key: string };
          update: { value: string };
          create: { key: string; value: string };
        }) => {
          const value = rows.has(where.key) ? update.value : create.value;
          rows.set(where.key, value);
          return { key: where.key, value };
        },
      },
    } as any,
  };
}

describe("settings service", () => {
  it("falls back to the BUSINESS_PHONE env when nothing is saved", async () => {
    const original = env.businessPhone;
    env.businessPhone = "09030614990";
    try {
      const { db, rows } = makeDb();
      rows.clear();
      assert.equal(await getBusinessPhone(db), "09030614990");
    } finally {
      env.businessPhone = original;
    }
  });

  it("prefers the saved value over the env fallback", async () => {
    const original = env.businessPhone;
    env.businessPhone = "09030614990";
    try {
      const { db, rows } = makeDb();
      rows.set(SETTING_BUSINESS_PHONE, "08123456789");
      assert.equal(await getBusinessPhone(db), "08123456789");
    } finally {
      env.businessPhone = original;
    }
  });

  it("round-trips a saved business phone", async () => {
    const { db } = makeDb();
    await setBusinessPhone(db, "08012345678");
    assert.equal(await getBusinessPhone(db), "08012345678");
  });

  it("round-trips the WhatsApp test recipient", async () => {
    const { db } = makeDb();
    assert.equal(await getWhatsappTestRecipient(db), "");
    await setWhatsappTestRecipient(db, "08012345678");
    assert.equal(await getWhatsappTestRecipient(db), "08012345678");
  });

  it("round-trips the WhatsApp template name and language", async () => {
    const { db } = makeDb();
    assert.equal(await getWhatsappTemplateName(db), "");
    assert.equal(await getWhatsappTemplateLanguage(db), "");
    await setWhatsappTemplateName(db, "laundry_ready");
    await setWhatsappTemplateLanguage(db, "en");
    assert.equal(await getWhatsappTemplateName(db), "laundry_ready");
    assert.equal(await getWhatsappTemplateLanguage(db), "en");
  });
});
