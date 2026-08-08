import { prisma } from "../lib/db.js";
import { reconcilePendingPayments } from "../services/paymentService.js";

/** How often the pending-transfer sweep runs. */
export const RECONCILE_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Start the background reconciliation sweep. Guarded so repeated calls in tests
 * (or tsx watch restarts) don't stack timers. The timer is unref'd so it never
 * keeps the process alive on its own.
 */
export function startReconciliation(): NodeJS.Timeout {
  const timer = setInterval(() => {
    reconcilePendingPayments(prisma)
      .then((result) => {
        if (result.checked > 0) {
          console.log(
            `[reconcile] checked=${result.checked} paid=${result.paid} failed=${result.failed}`
          );
        }
      })
      .catch((err) => console.error("[reconcile] sweep failed:", err));
  }, RECONCILE_INTERVAL_MS);
  timer.unref();
  return timer;
}
