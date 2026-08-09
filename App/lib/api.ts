export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ServiceType = "wash_and_fold" | "iron_only";
export type PickupWindow = "morning" | "afternoon" | "evening";
export type DeliveryWindow = "same_day" | "next_day" | "custom";
export type PaymentMethod = "transfer" | "cash";
export type PaymentStatus = "pending" | "paid" | "unpaid" | "failed";
export type OrderStatus =
  | "booked"
  | "picked_up"
  | "in_progress"
  | "ready_for_delivery"
  | "delivered"
  | "cancelled";

export interface RateConfig {
  wash_and_fold: number;
  iron_only: number;
}

export interface Customer {
  id: string;
  phone: string;
  email: string | null;
  whatsapp_ok: boolean;
  created_at: string;
}

export interface OrderStatusLog {
  id: string;
  order_id: string;
  status: OrderStatus;
  created_at: string;
}

export interface CreateOrderInput {
  phone: string;
  email: string;
  whatsapp_ok?: boolean;
  service_type: ServiceType;
  item_count: number;
  pickup_address: string;
  pickup_window: PickupWindow;
  delivery_window: DeliveryWindow;
  delivery_date?: string | null;
  payment_method: PaymentMethod;
}

export interface Order {
  id: string;
  customer_id: string;
  service_type: ServiceType;
  item_count: number;
  rate_applied: number;
  cost: number;
  adjustment: number;
  adjustment_note: string | null;
  final_cost: number;
  pickup_address: string;
  pickup_window: PickupWindow;
  delivery_window: DeliveryWindow;
  delivery_date: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  status: OrderStatus;
  status_updated_at: string;
  note: string | null;
  created_at: string;
  status_logs?: OrderStatusLog[];
  customer?: Customer;
}

export interface OrderWithCustomer extends Order {
  customer: Customer;
  status_logs?: OrderStatusLog[];
  payment_overdue?: boolean;
}

export interface CreateOrderResult {
  order: Order;
  payment_link: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "network", "Could not reach the server. Check your connection.");
  }

  if (!res.ok) {
    let code = "unknown";
    let message = `Request failed (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      if (body?.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
      }
    } catch {
      // keep defaults
    }
    throw new ApiError(res.status, code, message);
  }

  return (await res.json()) as T;
}

export function fetchRateConfig(): Promise<RateConfig> {
  return request<RateConfig>("/rate-config");
}

export interface PublicConfig {
  business_phone: string;
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  return request<PublicConfig>("/public/config");
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  return request<CreateOrderResult>("/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchOrder(id: string): Promise<Order> {
  const data = await request<{ order: Order }>(`/orders/${id}`);
  return data.order;
}
