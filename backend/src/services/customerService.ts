import type { PrismaClient } from "@prisma/client";

/**
 * Find-or-create a customer by phone. New bookings always provide an email
 * (the primary status-update channel); when an existing customer re-books we
 * refresh it so a typo'd address on an earlier order self-corrects.
 */
export async function findOrCreateCustomer(
  db: PrismaClient,
  phone: string,
  email: string,
  whatsappOk: boolean = true
) {
  const existing = await db.customer.findUnique({ where: { phone } });
  if (existing) {
    if (existing.whatsapp_ok !== whatsappOk || existing.email !== email) {
      return db.customer.update({
        where: { id: existing.id },
        data: { whatsapp_ok: whatsappOk, email },
      });
    }
    return existing;
  }
  return db.customer.create({ data: { phone, email, whatsapp_ok: whatsappOk } });
}
