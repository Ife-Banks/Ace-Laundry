import type { DeliveryWindow, OrderStatus, PaymentMethod, PaymentStatus, PickupWindow, ServiceType } from "./api";

export const serviceLabels: Record<ServiceType, string> = {
  wash_and_fold: "Wash & Fold",
  iron_only: "Iron Only",
};

export const pickupWindowLabels: Record<PickupWindow, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export const deliveryWindowLabels: Record<DeliveryWindow, string> = {
  same_day: "Same day",
  next_day: "Next day",
  custom: "Custom date",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  transfer: "Bank transfer",
  cash: "Pay on delivery",
};

export const fulfillmentLabels: Record<OrderStatus, string> = {
  booked: "Booked",
  picked_up: "Picked up",
  in_progress: "Washing",
  ready_for_delivery: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  unpaid: "Unpaid",
  failed: "Failed",
};

export const fulfillmentDescriptions: Record<Exclude<OrderStatus, "cancelled">, string> = {
  booked: "Order placed",
  picked_up: "Laundry picked up",
  in_progress: "Washing in progress",
  ready_for_delivery: "Ready for delivery",
  delivered: "Delivered",
};

export const nextFulfillment: Partial<Record<OrderStatus, Exclude<OrderStatus, "cancelled">>> = {
  booked: "picked_up",
  picked_up: "in_progress",
  in_progress: "ready_for_delivery",
  ready_for_delivery: "delivered",
};
