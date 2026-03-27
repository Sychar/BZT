import { DateTime } from "luxon";
import { prisma } from "../src/prisma";
import { createDailyBatchForVendor } from "../src/services/batchService";
import { getBatchWindowForDate, TIMEZONE } from "../src/utils/time";
import { createCustomer, createVendorWithProduct } from "./helpers";

describe("Daily batch cron", () => {
  it("aggregates order items per product", async () => {
    const customer = await createCustomer();
    const { vendor, product } = await createVendorWithProduct();

    const batchDate = DateTime.fromISO("2026-02-05", { zone: TIMEZONE }).startOf("day");
    const { start, end } = getBatchWindowForDate(batchDate, vendor.cutoffTime);

    const orderTime1 = start.plus({ hours: 2 }).toUTC().toJSDate();
    const orderTime2 = end.minus({ hours: 1 }).toUTC().toJSDate();

    await prisma.order.create({
      data: {
        userId: customer.id,
        vendorId: vendor.id,
        pickupWindow: "06:00-09:00",
        note: null,
        createdAt: orderTime1,
        items: {
          create: [
            {
              productId: product.id,
              qty: 2,
              unitPrice: product.price
            }
          ]
        }
      }
    });

    await prisma.order.create({
      data: {
        userId: customer.id,
        vendorId: vendor.id,
        pickupWindow: "06:00-09:00",
        note: null,
        createdAt: orderTime2,
        items: {
          create: [
            {
              productId: product.id,
              qty: 3,
              unitPrice: product.price
            }
          ]
        }
      }
    });

    const batch = await createDailyBatchForVendor(vendor.id, batchDate, vendor.cutoffTime);
    const items = await prisma.dailyBatchItem.findMany({ where: { batchId: batch.id } });
    const orders = await prisma.dailyBatchOrder.findMany({ where: { batchId: batch.id } });

    expect(items).toHaveLength(1);
    expect(items[0].totalQty).toBe(5);
    expect(orders).toHaveLength(2);
  });
});
