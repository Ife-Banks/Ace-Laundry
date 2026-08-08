-- CreateTable
CREATE TABLE "OrderStatusLog" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "gateway_event_key" TEXT NOT NULL,
    "order_id" TEXT,
    "event_type" TEXT,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderStatusLog_order_id_idx" ON "OrderStatusLog"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_gateway_event_key_key" ON "WebhookEvent"("gateway_event_key");

-- CreateIndex
CREATE INDEX "WebhookEvent_order_id_idx" ON "WebhookEvent"("order_id");

-- CreateIndex
CREATE INDEX "WebhookEvent_created_at_idx" ON "WebhookEvent"("created_at");

-- CreateIndex
CREATE INDEX "Order_payment_reference_idx" ON "Order"("payment_reference");

-- AddForeignKey
ALTER TABLE "OrderStatusLog" ADD CONSTRAINT "OrderStatusLog_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
