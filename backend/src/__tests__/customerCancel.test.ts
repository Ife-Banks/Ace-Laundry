import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../lib/errors.js";
import { customerCancelOrder } from "../services/orderService.js";

// Minimal in-memory stand-in for the Prisma methods the cancel path touches.
function makeDb(initialOrder: any) {
  let order: any = initialOrder;
  const logs: any[] = [];
  return {
    logs,
    db: {
      order: {
        findUnique: async () => order,
        update: async ({ data, include }: any) => {
          order = { ...order, ...data };
          if (include?.customer) order.customer = initialOrder.customer;
          return order;
        },
      },
      orderStatusLog: {
        create: async ({ data }: any) => {
          logs.push(data);
          return data;
        },
      },
    } as any,
  };
}

function bookedOrder() {
  return {
    id: "order-1",
    status: "booked",
    customer: { phone: "08012345678" },
  };
}

describe("customerCancelOrder", () => {
  it("cancels a booked order when the OTP-verified phone matches", async () => {
    const { db, logs } = makeDb(bookedOrder());
    const updated = await customerCancelOrder(db, "order-1", "08012345678", "Wrong date");
    assert.equal(updated.status, "cancelled");
    assert.equal(updated.note, "Wrong date");
    assert.equal(logs.length, 1);
    assert.equal(logs[0].status, "cancelled");
  });

  it("rejects a caller whose phone does not match the order", async () => {
    const { db } = makeDb(bookedOrder());
    await assert.rejects(
      () => customerCancelOrder(db, "order-1", "08099999999", "Wrong date"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as HttpError).status, 401);
        assert.equal((err as HttpError).code, "unauthorized");
        return true;
      }
    );
  });

  it("rejects cancellation after pickup", async () => {
    const { db } = makeDb({ ...bookedOrder(), status: "picked_up" });
    await assert.rejects(
      () => customerCancelOrder(db, "order-1", "08012345678", "Changed my mind"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as HttpError).status, 409);
        assert.equal((err as HttpError).code, "customer_cancel_window");
        return true;
      }
    );
  });

  it("rejects an unknown order", async () => {
    const { db } = makeDb(null);
    await assert.rejects(
      () => customerCancelOrder(db, "nope", "08012345678", "Reason"),
      (err: unknown) => {
        assert.ok(err instanceof HttpError);
        assert.equal((err as HttpError).status, 404);
        return true;
      }
    );
  });
});
