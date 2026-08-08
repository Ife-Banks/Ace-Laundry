"use client";

import { ApiError, request, type OrderWithCustomer } from "./api";

// Persistent customer session (docs/05 §2.6, docs/06 §5). The OTP-verified
// token lives 7 days and is stored in localStorage so the customer stays
// remembered on their device between visits. The verified phone is stored
// alongside it so the app knows which number the token belongs to — the token
// itself is only ever sent to the backend as a bearer credential.
const TOKEN_KEY = "history_token";
const PHONE_KEY = "history_phone";

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getHistoryToken(): string | null {
  return readToken();
}

export function getVerifiedPhone(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PHONE_KEY);
}

export function clearHistoryToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(PHONE_KEY);
  }
}

export async function requestOtp(phone: string): Promise<void> {
  await request<{ ok: boolean }>("/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(phone: string, code: string): Promise<void> {
  const data = await request<{ token: string }>("/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
  window.localStorage.setItem(TOKEN_KEY, data.token);
  window.localStorage.setItem(PHONE_KEY, phone);
}

export async function fetchHistoryOrders(phone: string): Promise<OrderWithCustomer[]> {
  const token = readToken();
  if (!token) {
    throw new ApiError(401, "unauthorized", "Your session expired. Request a new code.");
  }
  const data = await request<{ orders: OrderWithCustomer[] }>(
    `/customers/${encodeURIComponent(phone)}/orders`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data.orders;
}

export async function customerCancelOrder(orderId: string, note: string): Promise<void> {
  const token = readToken();
  if (!token) {
    throw new ApiError(401, "unauthorized", "Verify your phone number to cancel this order.");
  }
  await request(`/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ note }),
  });
}
