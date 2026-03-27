import { Router } from "express";
import { DateTime } from "luxon";
import { authRequired, requireRole } from "../middleware/auth";
import { prisma } from "../prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { TIMEZONE, getCurrentBatchDate } from "../utils/time";
import { createDailyBatchForVendor, getBatchWithDetails } from "../services/batchService";

const router = Router();

const buildResponse = (batch: NonNullable<Awaited<ReturnType<typeof getBatchWithDetails>>>) => {
  return {
    vendorId: batch.vendorId,
    batchDate: DateTime.fromJSDate(batch.batchDate, { zone: TIMEZONE }).toISODate(),
    items: batch.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      totalQty: item.totalQty
    })),
    orders: batch.orders.map((link) => link.order)
  };
};

router.get(
  "/:id/batch/today",
  authRequired,
  requireRole("VENDOR"),
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    if (req.user?.vendorId !== vendorId) {
      return res.status(403).json({ error: "Keine Berechtigung." });
    }
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ error: "Anbieter nicht gefunden." });
    }
    const batchDate = getCurrentBatchDate(vendor.cutoffTime);
    await createDailyBatchForVendor(vendorId, batchDate, vendor.cutoffTime);
    const batch = await getBatchWithDetails(vendorId, batchDate);
    if (!batch) {
      return res.status(404).json({ error: "Batch nicht gefunden." });
    }
    return res.json(buildResponse(batch));
  })
);

router.get(
  "/:id/batch/:date",
  authRequired,
  requireRole("VENDOR"),
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    if (req.user?.vendorId !== vendorId) {
      return res.status(403).json({ error: "Keine Berechtigung." });
    }
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ error: "Anbieter nicht gefunden." });
    }
    const batchDate = DateTime.fromISO(req.params.date, { zone: TIMEZONE }).startOf("day");
    await createDailyBatchForVendor(vendorId, batchDate, vendor.cutoffTime);
    const batch = await getBatchWithDetails(vendorId, batchDate);
    if (!batch) {
      return res.status(404).json({ error: "Batch nicht gefunden." });
    }
    return res.json(buildResponse(batch));
  })
);

export default router;
