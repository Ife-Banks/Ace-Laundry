-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('wash_and_fold', 'iron_only');

-- CreateEnum
CREATE TYPE "PickupWindow" AS ENUM ('morning', 'afternoon', 'evening');

-- CreateEnum
CREATE TYPE "DeliveryWindow" AS ENUM ('same_day', 'next_day', 'custom');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('transfer', 'cash');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'unpaid', 'failed');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('booked', 'picked_up', 'in_progress', 'ready_for_delivery', 'delivered', 'cancelled');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp_ok" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "service_type" "ServiceType" NOT NULL,
    "item_count" INTEGER NOT NULL,
    "rate_applied" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "adjustment" INTEGER NOT NULL DEFAULT 0,
    "adjustment_note" TEXT,
    "final_cost" INTEGER NOT NULL,
    "pickup_address" TEXT NOT NULL,
    "pickup_window" "PickupWindow" NOT NULL,
    "delivery_window" "DeliveryWindow" NOT NULL,
    "delivery_date" TIMESTAMP(3),
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "payment_reference" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'booked',
    "status_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "wash_and_fold" INTEGER NOT NULL,
    "iron_only" INTEGER NOT NULL,

    CONSTRAINT "RateConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "order_id" TEXT,
    "recipient" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Order_customer_id_idx" ON "Order"("customer_id");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_payment_status_idx" ON "Order"("payment_status");

-- CreateIndex
CREATE INDEX "NotificationLog_order_id_idx" ON "NotificationLog"("order_id");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

