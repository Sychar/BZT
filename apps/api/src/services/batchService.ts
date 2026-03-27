import { DateTime } from "luxon";
import { prisma } from "../prisma";
import { TIMEZONE, getBatchWindowForDate, getCurrentBatchDate, toUtcDate } from "../utils/time";

type AggregatedItem = {
  productId: string;
  productName: string;
  totalQty: number;
};

const aggregateOrderItems = (orders: Array<{ items: Array<{ productId: string; qty: number; product: { name: string } }> }>) => {
  const totals = new Map<string, AggregatedItem>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = totals.get(item.productId);
      if (existing) {
        existing.totalQty += item.qty;
      } else {
        totals.set(item.productId, {
          productId: item.productId,
          productName: item.product.name,
          totalQty: item.qty
        });
      }
    }
  }
  return Array.from(totals.values());
};

export const createDailyBatchForVendor = async (vendorId: string, batchDate: DateTime, cutoffTime: string) => {
  const batchDateUtc = toUtcDate(batchDate);
  const existing = await prisma.dailyBatch.findUnique({
    where: {
      vendorId_batchDate: {
        vendorId,
        batchDate: batchDateUtc
      }
    }
  });
  if (existing) {
    return existing;
  }

  const { start, end } = getBatchWindowForDate(batchDate, cutoffTime);
  const orders = await prisma.order.findMany({
    where: {
      vendorId,
      createdAt: {
        gte: start.toUTC().toJSDate(),
        lt: end.toUTC().toJSDate()
      }
    },
    include: {
      items: { include: { product: true } },
      user: true
    },
    orderBy: { createdAt: "asc" }
  });

  const aggregated = aggregateOrderItems(
    orders.map((order) => ({ items: order.items }))
  );

  const batch = await prisma.dailyBatch.create({
    data: {
      vendorId,
      batchDate: batchDateUtc,
      rangeStart: start.toUTC().toJSDate(),
      rangeEnd: end.toUTC().toJSDate(),
      items: {
        create: aggregated.map((item) => ({
          productId: item.productId,
          totalQty: item.totalQty
        }))
      },
      orders: {
        create: orders.map((order) => ({ orderId: order.id }))
      }
    }
  });

  return batch;
};

export const getBatchWithDetails = async (vendorId: string, batchDate: DateTime) => {
  const batch = await prisma.dailyBatch.findUnique({
    where: {
      vendorId_batchDate: {
        vendorId,
        batchDate: toUtcDate(batchDate)
      }
    },
    include: {
      items: { include: { product: true } },
      orders: {
        include: {
          order: {
            include: {
              items: { include: { product: true } },
              user: true
            }
          }
        }
      }
    }
  });

  return batch;
};

export const createDailyBatchesForAllVendors = async (
  now = DateTime.now().setZone(TIMEZONE)
) => {
  const vendors = await prisma.vendor.findMany({
    where: { type: { in: ["BAECKER", "METZGER"] } }
  });
  for (const vendor of vendors) {
    const batchDate = getCurrentBatchDate(vendor.cutoffTime, now);
    await createDailyBatchForVendor(vendor.id, batchDate, vendor.cutoffTime);
  }
};
