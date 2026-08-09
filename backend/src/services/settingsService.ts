import type { PrismaClient } from "@prisma/client";
import { env } from "../lib/env.js";

export const SETTING_BUSINESS_PHONE = "business_phone";
export const SETTING_WHATSAPP_TEST_RECIPIENT = "whatsapp_test_recipient";
export const SETTING_WHATSAPP_TEMPLATE_NAME = "whatsapp_template_name";
export const SETTING_WHATSAPP_TEMPLATE_LANGUAGE = "whatsapp_template_language";

// Used as the default {{1}} parameter when testing a WhatsApp template.
export const BUSINESS_NAME = "Ace Laundry";

/**
 * Operator-configurable settings (docs/01 §1.3). Values live in the Setting
 * table once saved; before that, DB reads fall back to env so a fresh install
 * works with no seed. The operator Settings screen writes here.
 */
async function getSetting(db: PrismaClient, key: string): Promise<string> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? "";
}

async function setSetting(db: PrismaClient, key: string, value: string): Promise<string> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  return value;
}

export async function getBusinessPhone(db: PrismaClient): Promise<string> {
  const saved = await getSetting(db, SETTING_BUSINESS_PHONE);
  return saved || env.businessPhone;
}

export async function setBusinessPhone(db: PrismaClient, value: string): Promise<string> {
  return setSetting(db, SETTING_BUSINESS_PHONE, value);
}

export async function getWhatsappTestRecipient(db: PrismaClient): Promise<string> {
  return getSetting(db, SETTING_WHATSAPP_TEST_RECIPIENT);
}

export async function setWhatsappTestRecipient(db: PrismaClient, value: string): Promise<string> {
  return setSetting(db, SETTING_WHATSAPP_TEST_RECIPIENT, value);
}

export async function getWhatsappTemplateName(db: PrismaClient): Promise<string> {
  return getSetting(db, SETTING_WHATSAPP_TEMPLATE_NAME);
}

export async function setWhatsappTemplateName(db: PrismaClient, value: string): Promise<string> {
  return setSetting(db, SETTING_WHATSAPP_TEMPLATE_NAME, value);
}

export async function getWhatsappTemplateLanguage(db: PrismaClient): Promise<string> {
  return getSetting(db, SETTING_WHATSAPP_TEMPLATE_LANGUAGE);
}

export async function setWhatsappTemplateLanguage(db: PrismaClient, value: string): Promise<string> {
  return setSetting(db, SETTING_WHATSAPP_TEMPLATE_LANGUAGE, value);
}
