export const PHONE_PATTERN = /^0\d{10}$/;

export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, "").trim();
}

export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone);
}
