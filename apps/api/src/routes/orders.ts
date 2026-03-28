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
  date: z.string().optional(),
  period: z.enum(["day", "week", "month"]).optional()
});

const vendorInvoicePdfQuery = z.object({
  date: z.string().optional(),
  companyId: z.string().uuid()
});

type VendorPeriod = "day" | "week" | "month";

const resolveVendorRange = (params: {
  cutoffTime: string;
  period?: VendorPeriod;
  date?: string;
}) => {
  const period = params.period ?? "day";
  const baseDate = params.date
    ? DateTime.fromISO(params.date, { zone: TIMEZONE }).startOf("day")
    : DateTime.now().setZone(TIMEZONE).startOf("day");

  if (!baseDate.isValid) {
    return null;
  }

  if (period === "day") {
    const batchDate = params.date
      ? DateTime.fromISO(params.date, { zone: TIMEZONE }).startOf("day")
      : getCurrentBatchDate(params.cutoffTime);
    if (!batchDate.isValid) return null;
    const { start, end } = getBatchWindowForDate(batchDate, params.cutoffTime);
    return {
      period,
      batchDate,
      start,
      end,
      periodLabel: batchDate.toFormat("dd.MM.yyyy")
    };
  }

  if (period === "week") {
    const start = baseDate.startOf("week");
    const end = start.plus({ weeks: 1 });
    return {
      period,
      batchDate: start,
      start,
      end,
      periodLabel: `${start.toFormat("dd.MM.yyyy")} - ${end
        .minus({ days: 1 })
        .toFormat("dd.MM.yyyy")}`
    };
  }

  const start = baseDate.startOf("month");
  const end = start.plus({ months: 1 });
  return {
    period,
    batchDate: start,
    start,
    end,
    periodLabel: start.toFormat("LLLL yyyy")
  };
};

const buildCompanyInvoicePdf = (params: {
  invoiceNo: string;
  vendorName: string;
  companyName: string;
  periodLabel: string;
  rows: Array<{
    orderId: string;
    createdAt: Date;
    positions: number;
    amount: number;
  }>;
  totalOrders: number;
  totalPositions: number;
  totalAmount: number;
  averageAmount: number;
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

    doc.fontSize(20).text("Rechnung");
    doc.moveDown(0.4);
    doc.fontSize(11).text(`Rechnungsnummer: ${params.invoiceNo}`);
    doc.text(`Monat: ${params.periodLabel}`);
    doc.moveDown(0.6);

    doc.fontSize(11).text(`Von: ${params.vendorName}`);
    doc.text(`An: ${params.companyName}`);
    doc.moveDown(0.8);

    doc.fontSize(12).text("Leistungsübersicht", { underline: true });
    doc.moveDown(0.5);

    if (params.rows.length === 0) {
      doc.fontSize(11).text("Keine Bestellungen im gewählten Zeitraum.");
      doc.end();
      return;
    }

    params.rows.forEach((row, index) => {
      const createdAt = DateTime.fromJSDate(row.createdAt, { zone: TIMEZONE }).toFormat("dd.MM.yyyy");
      doc
        .fontSize(10)
        .text(
          `${index + 1}. ${createdAt} | Bestellung ${row.orderId.slice(
            0,
            8
          )} | Positionen ${row.positions} | ${row.amount.toFixed(2)} EUR`
        );
      doc.moveDown(0.2);
    });

    doc.moveDown(0.8);
    doc.fontSize(12).text("Zusammenfassung", { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(11).text(`Anzahl Bestellungen: ${params.totalOrders}`);
    doc.text(`Anzahl Positionen: ${params.totalPositions}`);
    doc.text(`Durchschnitt pro Bestellung: ${params.averageAmount.toFixed(2)} EUR`);
    doc.fontSize(13).text(`Gesamtbetrag: ${params.totalAmount.toFixed(2)} EUR`);

    doc.moveDown(1);
    doc.fontSize(9).fillColor("#64748b").text("Erstellt durch BZT Lieferantenportal");
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

    const query = req.query as z.infer<typeof vendorOrdersQuery>;
    const resolved = resolveVendorRange({
      cutoffTime: vendor.cutoffTime,
      period: query.period,
      date: query.date
    });
    if (!resolved) {
      return res.status(400).json({ error: "Datum ungültig." });
    }

    const orders = await prisma.order.findMany({
      where: {
        vendorId,
        createdAt: {
          gte: resolved.start.toUTC().toJSDate(),
          lt: resolved.end.toUTC().toJSDate()
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

    const companyGroups = Array.from(companyBuckets.values())
      .map((group) => ({
        ...group,
        averageOrderValue: group.ordersCount > 0 ? group.totalAmount / group.ordersCount : 0
      }))
      .sort((a, b) => a.companyName.localeCompare(b.companyName, "de"));

    const totalAmount = companyGroups.reduce((sum, group) => sum + group.totalAmount, 0);
    const totalOrders = companyGroups.reduce((sum, group) => sum + group.ordersCount, 0);
    const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;

    return res.json({
      period: resolved.period,
      periodLabel: resolved.periodLabel,
      batchDate: resolved.batchDate.toISODate(),
      rangeStart: resolved.start.toISO(),
      rangeEnd: resolved.end.toISO(),
      stats: {
        totalOrders,
        totalAmount,
        averageOrderValue
      },
      orders,
      companyGroups
    });
  })
);

router.get(
  "/vendor/invoices/export-pdf",
  authRequired,
  requireRole("VENDOR"),
  validateQuery(vendorInvoicePdfQuery),
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

    const query = req.query as z.infer<typeof vendorInvoicePdfQuery>;
    const resolved = resolveVendorRange({
      cutoffTime: vendor.cutoffTime,
      period: "month",
      date: query.date
    });
    if (!resolved) {
      return res.status(400).json({ error: "Datum ungültig." });
    }

    const orders = await prisma.order.findMany({
      where: {
        vendorId: vendor.id,
        user: { companyId: query.companyId },
        createdAt: {
          gte: resolved.start.toUTC().toJSDate(),
          lt: resolved.end.toUTC().toJSDate()
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

    if (orders.length === 0) {
      return res.status(404).json({ error: "Keine Bestellungen für diese Firma im gewählten Monat." });
    }

    const companyName = orders[0].user.company?.name ?? "Firma";
    const rows = orders.map((order) => {
      const positions = order.items.reduce((sum, item) => sum + item.qty, 0);
      const amount = order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0);
      return {
        orderId: order.id,
        createdAt: order.createdAt,
        positions,
        amount
      };
    });

    const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
    const totalPositions = rows.reduce((sum, row) => sum + row.positions, 0);
    const averageAmount = rows.length > 0 ? totalAmount / rows.length : 0;
    const invoiceNo = `INV-${resolved.batchDate.toFormat("yyyyMM")}-${query.companyId
      .slice(0, 6)
      .toUpperCase()}`;

    const pdfBuffer = await buildCompanyInvoicePdf({
      invoiceNo,
      vendorName: vendor.name,
      companyName,
      periodLabel: resolved.batchDate.toFormat("LLLL yyyy"),
      rows,
      totalOrders: rows.length,
      totalPositions,
      totalAmount,
      averageAmount
    });

    const safeCompany = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"rechnung-${safeCompany}-${resolved.batchDate.toFormat("yyyy-MM")}.pdf\"`
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

