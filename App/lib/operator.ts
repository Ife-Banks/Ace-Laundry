"use client";

import { useSyncExternalStore } from "react";
import {
  request,
  type OrderStatus,
  type OrderWithCustomer,
  type PaymentStatus,
  type RateConfig,
} from "./api";

const TOKEN_KEY = "operator_token";

const authListeners = new Set<() => void>();
function notifyAuthChange() {
  for (const listener of authListeners) listener();
}
function subscribeAuth(callback: () => void): () => void {
  authListeners.add(callback);
  return () => authListeners.delete(callback);
}
function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

/**
 * Reactive operator-auth flag. Server snapshot is always false so the shell
 * never hydrates with a different value than it rendered.
 */
export function useOperatorAuth(): boolean {
  return useSyncExternalStore(
    subscribeAuth,
    () => Boolean(readToken()),
    () => false
  );
}

export function getOperatorToken(): string | null {
  return readToken();
}

export function setOperatorToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  notifyAuthChange();
}

export function clearOperatorToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  notifyAuthChange();
}

export function isOperatorLoggedIn(): boolean {
  return Boolean(readToken());
}

function authHeader(): Record<string, string> {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function operatorLogin(password: string): Promise<void> {
  const data = await request<{ token: string }>("/operator/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  setOperatorToken(data.token);
}

export interface OperatorOrderQuery {
  status?: OrderStatus | "";
  payment_status?: PaymentStatus | "";
  phone?: string;
  sort?: "pickup" | "created";
}

export async function fetchOperatorOrders(
  query: OperatorOrderQuery
): Promise<OrderWithCustomer[]> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.payment_status) params.set("payment_status", query.payment_status);
  if (query.phone) params.set("phone", query.phone);
  if (query.sort) params.set("sort", query.sort);
  const qs = params.toString();
  const data = await request<{ orders: OrderWithCustomer[] }>(
    `/operator/orders${qs ? `?${qs}` : ""}`,
    { headers: authHeader() }
  );
  return data.orders;
}

export async function fetchOperatorOrder(id: string): Promise<OrderWithCustomer> {
  const data = await request<{ order: OrderWithCustomer }>(`/operator/orders/${id}`, {
    headers: authHeader(),
  });
  return data.order;
}

export async function advanceOrder(id: string): Promise<OrderWithCustomer> {
  const data = await request<{ order: OrderWithCustomer }>(`/operator/orders/${id}/advance`, {
    method: "PATCH",
    headers: authHeader(),
  });
  return data.order;
}

export async function cancelOrder(id: string, note: string): Promise<OrderWithCustomer> {
  const data = await request<{ order: OrderWithCustomer }>(`/operator/orders/${id}/cancel`, {
    method: "PATCH",
    headers: authHeader(),
    body: JSON.stringify({ note }),
  });
  return data.order;
}

export async function setOrderPaymentStatus(
  id: string,
  payment_status: "paid" | "unpaid"
): Promise<OrderWithCustomer> {
  const data = await request<{ order: OrderWithCustomer }>(
    `/operator/orders/${id}/payment-status`,
    {
      method: "PATCH",
      headers: authHeader(),
      body: JSON.stringify({ payment_status }),
    }
  );
  return data.order;
}

export async function adjustOrder(
  id: string,
  adjustment: number,
  note?: string
): Promise<OrderWithCustomer> {
  const data = await request<{ order: OrderWithCustomer }>(`/operator/orders/${id}/adjustment`, {
    method: "PATCH",
    headers: authHeader(),
    body: JSON.stringify({ adjustment, note }),
  });
  return data.order;
}

export async function fetchCustomerOrders(phone: string): Promise<OrderWithCustomer[]> {
  const data = await request<{ orders: OrderWithCustomer[] }>(
    `/operator/customers/${encodeURIComponent(phone)}/orders`,
    { headers: authHeader() }
  );
  return data.orders;
}

export async function updateRateConfig(input: {
  wash_and_fold: number;
  iron_only: number;
}): Promise<RateConfig> {
  return request<RateConfig>("/rate-config", {
    method: "PATCH",
    headers: authHeader(),
    body: JSON.stringify(input),
  });
}
