// Minimal in-process event bus for cross-cutting concerns (notifications).
// The Notification Service subscribes to these events; Order/Payment Services
// publish them. Publish is fire-and-forget: handler failures never propagate
// to the caller, so a notification outage can't block an order state change
// (docs/05 §2.5).

export type EventName = "order.created" | "order.status_changed" | "payment.failed";

type Handler = (payload: unknown) => void | Promise<void>;

const handlers = new Map<EventName, Set<Handler>>();

export function on(name: EventName, handler: Handler) {
  let set = handlers.get(name);
  if (!set) {
    set = new Set();
    handlers.set(name, set);
  }
  set.add(handler);
}

export function publish(name: EventName, payload: unknown) {
  const set = handlers.get(name);
  if (!set) return;
  for (const handler of set) {
    try {
      void Promise.resolve(handler(payload)).catch((err) =>
        console.error(`[events] ${name} handler failed:`, err)
      );
    } catch (err) {
      console.error(`[events] ${name} handler failed:`, err);
    }
  }
}
