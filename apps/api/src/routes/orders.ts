import { Router } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import PDFDocument from "pdfkit";
import { prisma } from "../prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody, validateQuery } from "../utils/validation";
import { authRequired, requireRole } from "../middleware/auth";
import { TIMEZONE, getBatchWindowForDate, getCurrentBatchDate } from "../utils/time";

const router = Router();

const createSchema = z.object({
  vendorId: z.string().uuid(),
  pickupWindow: z.string().min(3),
  note: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        qty: z.number().int().min(1),
        itemNote: z.string().optional()
      })
    )
    .min(1)
});

const statusSchema = z.object({
  status: z.enum(["EINGEGANGEN", "IN_BEARBEITUNG", "FERTIG", "ABGEHOLT", "STORNIERT"])
});

const vendorOrdersQuery = z.object({
  date: z.string().optional()
});

const buildVendorInvoicesPdf = (params: {
  vendorName: string;
  dateLabel: string;
  rows: Array<{
    orderId: string;
    companyName: string;
    employeeName: string;
    pickupWindow: string;
    createdAt: Date;
    positions: number;
    totalAmount: number;
  }>;
  totalOrders: number;
  totalPositions: number;
  totalAmount: number;
}) =>
  new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 42
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Lieferanten-Rechnungsauszug");
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Anbieter: ${params.vendorName}`);
    doc.text(`Datum: ${params.dateLabel}`);
    doc.text(`Bestellungen: ${params.totalOrders}`);
    doc.text(`Positionen: ${params.totalPositions}`);
    doc.text(`Gesamtbetrag: ${params.totalAmount.toFixed(2)} EUR`);
    doc.moveDown();

    if (params.rows.length === 0) {
      doc.fontSize(11).text("Keine Bestellungen für dieses Datum.");
      doc.end();
      return;
    }

    params.rows.forEach((row, index) => {
      doc
        .fontSize(11)
        .text(
          `${index + 1}. Firma: ${row.companyName} | Mitarbeiter: ${row.employeeName}`
        );
      doc
        .fontSize(10)
        .text(
          `Order ${row.orderId} | ${DateTime.fromJSDate(row.createdAt, {
            zone: TIMEZONE
          }).toFormat("dd.MM.yyyy HH:mm")} | Abholung ${row.pickupWindow} | Positionen ${row.positions} | Summe ${row.totalAmount.toFixed(2)} EUR`
        );
      doc.moveDown(0.45);
    });

    doc.end();
  });

router.post(
  "/",
  authRequired,
  requireRole("CUSTOMER"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const { vendorId, pickupWindow, note, items } = req.body;
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ error: "Anbieter nicht gefunden." });
    }
    if (vendor.visibility === "COMPANY_ONLY") {
      if (req.user?.customerType !== "EMPLOYEE" || !req.user.companyId) {
        return res.status(403).json({ error: "Nur für Firmen-Mitarbeiter." });
      }
      const link = await prisma.vendorCompany.findUnique({
        where: {
          vendorId_companyId: {
            vendorId: vendor.id,
            companyId: req.user.companyId
          }
        }
      });
      if (!link || link.status !== "APPROVED") {
        return res.status(403).json({ error: "Keine Berechtigung." });
      }
    }

    if (vendor.type === "RESTAURANT") {
      return res.status(400).json({ error: "Für Restaurants bitte den Menü-Checkout nutzen." });
    }
    const products = await prisma.product.findMany({
      where: {
        id: { in: items.map((item: { productId: string }) => item.productId) },
        vendorId,
        active: true
      }
    });
    if (products.length !== items.length) {
      return res.status(400).json({ error: "Produktliste ungültig." });
    }
    const productMap = new Map(products.map((product) => [product.id, product]));
    const order = await prisma.order.create({
      data: {
        userId: req.user!.userId,
        vendorId,
        pickupWindow,
        note: note ?? null,
        items: {
          create: items.map((item: { productId: string; qty: number; itemNote?: string }) => ({
            productId: item.productId,
            qty: item.qty,
            unitPrice: productMap.get(item.productId)!.price,
            itemNote: item.itemNote ?? null
          }))
        }
      },
      include: { items: true }
    });
    return res.status(201).json(order);
  })
);

router.get(
  "/",
  authRequired,
  requireRole("CUSTOMER"),
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.userId },
      include: {
        items: { include: { product: true } },
        vendor: true
      },
      orderBy: { createdAt: "desc" }
    });
    return res.json(orders);
  })
);

router.get(
  "/vendor",
  authRequired,
  requireRole("VENDOR"),
  validateQuery(vendorOrdersQuery),
  asyncHandler(async (req, res) => {
    const vendorId = req.user!.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ error: "Anbieter nicht gefunden." });
    }
    const dateParam = (req.query as { date?: string }).date;
    const batchDate = dateParam
      ? DateTime.fromISO(dateParam, { zone: TIMEZONE }).startOf("day")
      : getCurrentBatchDate(vendor.cutoffTime);
    const { start, end } = getBatchWindowForDate(batchDate, vendor.cutoffTime);
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
        user: {
          include: {
            company: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    const companyBuckets = new Map<
      string,
      {
        companyId: string | null;
        companyName: string;
        orders: typeof orders;
        ordersCount: number;
        totalAmount: number;
      }
    >();

    for (const order of orders) {
      const companyId = order.user.companyId ?? null;
      const key = companyId ?? "NO_COMPANY";
      const companyName = order.user.company?.name ?? "Ohne Firma";
      const totalAmount = order.items.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.qty,
        0
      );

      const existing = companyBuckets.get(key);
      if (existing) {
        existing.orders.push(order);
        existing.ordersCount += 1;
        existing.totalAmount += totalAmount;
      } else {
        companyBuckets.set(key, {
          companyId,
          companyName,
          orders: [order],
          ordersCount: 1,
          totalAmount
        });
      }
    }

    const companyGroups = Array.from(companyBuckets.values()).sort((a, b) =>
      a.companyName.localeCompare(b.companyName, "de")
    );

    return res.json({
      batchDate: batchDate.toISODate(),
      rangeStart: start.toISO(),
      rangeEnd: end.toISO(),
      orders,
      companyGroups
    });
  })
);

router.get(
  "/vendor/invoices/export-pdf",
  authRequired,
  requireRole("VENDOR"),
  validateQuery(vendorOrdersQuery),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        cutoffTime: true
      }
    });
    if (!vendor) {
      return res.status(404).json({ error: "Anbieter nicht gefunden." });
    }

    const dateParam = (req.query as { date?: string }).date;
    const batchDate = dateParam
      ? DateTime.fromISO(dateParam, { zone: TIMEZONE }).startOf("day")
      : getCurrentBatchDate(vendor.cutoffTime);
    const { start, end } = getBatchWindowForDate(batchDate, vendor.cutoffTime);

    const orders = await prisma.order.findMany({
      where: {
        vendorId: vendor.id,
        createdAt: {
          gte: start.toUTC().toJSDate(),
          lt: end.toUTC().toJSDate()
        }
      },
      include: {
        items: true,
        user: {
          include: {
            company: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    const rows = orders.map((order) => {
      const positions = order.items.reduce((sum, item) => sum + item.qty, 0);
      const totalAmount = order.items.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.qty,
        0
      );
      return {
        orderId: order.id,
        companyName: order.user.company?.name ?? "Ohne Firma",
        employeeName: order.user.name,
        pickupWindow: order.pickupWindow,
        createdAt: order.createdAt,
        positions,
        totalAmount
      };
    });

    const totalAmount = rows.reduce((sum, row) => sum + row.totalAmount, 0);
    const totalPositions = rows.reduce((sum, row) => sum + row.positions, 0);

    const pdfBuffer = await buildVendorInvoicesPdf({
      vendorName: vendor.name,
      dateLabel: batchDate.toISODate() ?? "",
      rows,
      totalOrders: rows.length,
      totalPositions,
      totalAmount
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"vendor-rechnungen-${batchDate.toISODate()}.pdf\"`
    );

    return res.send(pdfBuffer);
  })
);

router.patch(
  "/:id/status",
  authRequired,
  requireRole("VENDOR"),
  validateBody(statusSchema),
  asyncHandler(async (req, res) => {
    const vendorId = req.user!.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order || order.vendorId !== vendorId) {
      return res.status(404).json({ error: "Bestellung nicht gefunden." });
    }
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: req.body.status }
    });
    return res.json(updated);
  })
);

export default router;
