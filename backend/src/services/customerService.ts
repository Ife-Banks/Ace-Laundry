import type { PrismaClient } from "@prisma/client";

export async function findOrCreateCustomer(
  db: PrismaClient,
  phone: string,
  whatsappOk: boolean = true
) {
  const existing = await db.customer.findUnique({ where: { phone } });
  if (existing) {
    if (existing.whatsapp_ok !== whatsappOk) {
      return db.customer.update({
        where: { id: existing.id },
        data: { whatsapp_ok: whatsappOk },
      });
    }
    return existing;
  }
  return db.customer.create({ data: { phone, whatsapp_ok: whatsappOk } });
}
