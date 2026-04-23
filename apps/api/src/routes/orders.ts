import { Router } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs/promises";
import { Prisma } from "@prisma/client";
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

const invoiceMonthPattern = /^\d{4}-\d{2}$/;

const sendVendorInvoiceSchema = z.object({
  month: z.string().regex(invoiceMonthPattern),
  companyId: z.string().uuid()
});

const sentInvoicesQuery = z.object({
  month: z.string().regex(invoiceMonthPattern).optional()
});

type VendorPeriod = "day" | "week" | "month";

type InvoiceOrderRecord = Prisma.OrderGetPayload<{
  include: {
    items: true;
    user: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

type EmployeeInvoiceRow = {
  employeeId: string;
  employeeName: string;
  ordersCount: number;
  positionsCount: number;
  totalAmount: number;
};

type OrderInvoiceRow = {
  orderId: string;
  createdAt: Date;
  employeeName: string;
  positions: number;
  amount: number;
};

const COMPANY_INVOICE_ROOT = path.resolve(process.cwd(), "apps/api/uploads/company-invoices");

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

const parseInvoiceMonth = (value?: string) => {
  if (!value) {
    return DateTime.now().setZone(TIMEZONE).startOf("month");
  }
  const parsed = DateTime.fromFormat(value, "yyyy-MM", { zone: TIMEZONE }).startOf("month");
  if (!parsed.isValid) {
    return null;
  }
  return parsed;
};

const sanitizeFileToken = (raw: string) =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "rechnung";

const resolveStoredInvoicePath = (storedPath: string) => {
  const resolved = path.resolve(COMPANY_INVOICE_ROOT, storedPath);
  if (!resolved.startsWith(COMPANY_INVOICE_ROOT)) {
    throw new Error("Ungueltiger Dateipfad.");
  }
  return resolved;
};

const summarizeInvoiceOrders = (orders: InvoiceOrderRecord[]) => {
  const employeeMap = new Map<string, EmployeeInvoiceRow>();

  const orderRows: OrderInvoiceRow[] = orders.map((order) => {
    const positions = order.items.reduce((sum, item) => sum + item.qty, 0);
    const amount = order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0);
    const employeeName = order.user.name || "Mitarbeiter";

    const existing = employeeMap.get(order.user.id);
    if (existing) {
      existing.ordersCount += 1;
      existing.positionsCount += positions;
      existing.totalAmount += amount;
    } else {
      employeeMap.set(order.user.id, {
        employeeId: order.user.id,
        employeeName,
        ordersCount: 1,
        positionsCount: positions,
        totalAmount: amount
      });
    }

    return {
      orderId: order.id,
      createdAt: order.createdAt,
      employeeName,
      positions,
      amount
    };
  });

  const employeeRows = Array.from(employeeMap.values()).sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, "de")
  );

  const totalAmount = orderRows.reduce((sum, row) => sum + row.amount, 0);
  const totalPositions = orderRows.reduce((sum, row) => sum + row.positions, 0);
  const totalOrders = orderRows.length;
  const averageAmount = totalOrders > 0 ? totalAmount / totalOrders : 0;

  return {
    employeeRows,
    orderRows,
    totalAmount,
    totalPositions,
    totalOrders,
    averageAmount
  };
};

const buildCompanyInvoicePdf = (params: {
  invoiceNo: string;
  vendorName: string;
  companyName: string;
  periodLabel: string;
  employeeRows: EmployeeInvoiceRow[];
  orderRows: OrderInvoiceRow[];
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

    doc.fontSize(12).text("Mitarbeiter-Uebersicht", { underline: true });
    doc.moveDown(0.4);

    if (params.employeeRows.length === 0) {
      doc.fontSize(11).text("Keine Mitarbeiter-Bestellungen im gewaehlten Zeitraum.");
    } else {
      params.employeeRows.forEach((row, index) => {
        doc
          .fontSize(10)
          .text(
            `${index + 1}. ${row.employeeName} | Bestellungen ${row.ordersCount} | Positionen ${row.positionsCount} | ${row.totalAmount.toFixed(2)} EUR`
          );
        doc.moveDown(0.2);
      });
    }

    doc.moveDown(0.8);
    doc.fontSize(12).text("Bestelluebersicht", { underline: true });
    doc.moveDown(0.4);

    params.orderRows.forEach((row, index) => {
      const createdAt = DateTime.fromJSDate(row.createdAt, { zone: TIMEZONE }).toFormat("dd.MM.yyyy");
      doc
        .fontSize(10)
        .text(
          `${index + 1}. ${createdAt} | Bestellung ${row.orderId.slice(0, 8)} | ${row.employeeName} | Positionen ${row.positions} | ${row.amount.toFixed(2)} EUR`
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
        return res.status(403).json({ error: "Nur fuer Firmen-Mitarbeiter." });
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
      return res.status(400).json({ error: "Fuer Restaurants bitte den Menue-Checkout nutzen." });
    }
    const products = await prisma.product.findMany({
      where: {
        id: { in: items.map((item: { productId: string }) => item.productId) },
        vendorId,
        active: true
      }
    });
    if (products.length !== items.length) {
      return res.status(400).json({ error: "Produktliste ungueltig." });
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
      return res.status(400).json({ error: "Datum ungueltig." });
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
      const totalAmount = order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0);

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
  "/vendor/invoices/sent",
  authRequired,
  requireRole("VENDOR"),
  validateQuery(sentInvoicesQuery),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }

    const monthParam = (req.query as z.infer<typeof sentInvoicesQuery>).month;
    const month = parseInvoiceMonth(monthParam);
    if (!month) {
      return res.status(400).json({ error: "Monat ungueltig." });
    }

    const start = month.startOf("month");
    const end = start.plus({ months: 1 });

    const invoices = await prisma.companyInvoice.findMany({
      where: {
        vendorId,
        periodMonth: {
          gte: start.toUTC().toJSDate(),
          lt: end.toUTC().toJSDate()
        }
      },
      orderBy: [{ companyNameSnapshot: "asc" }]
    });

    return res.json(
      invoices.map((invoice) => ({
        id: invoice.id,
        companyId: invoice.companyId,
        companyName: invoice.companyNameSnapshot,
        invoiceNo: invoice.invoiceNo,
        month: DateTime.fromJSDate(invoice.periodMonth, { zone: TIMEZONE }).toFormat("yyyy-MM"),
        sentAt: invoice.sentAt,
        totalAmount: Number(invoice.totalAmount),
        ordersCount: invoice.ordersCount,
        positionsCount: invoice.positionsCount
      }))
    );
  })
);

router.post(
  "/vendor/invoices/send",
  authRequired,
  requireRole("VENDOR"),
  validateBody(sendVendorInvoiceSchema),
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
        ownerUserId: true,
        type: true
      }
    });
    if (!vendor) {
      return res.status(404).json({ error: "Anbieter nicht gefunden." });
    }
    if (vendor.ownerUserId !== req.user?.userId) {
      return res.status(403).json({ error: "Keine Berechtigung." });
    }
    if (vendor.type === "RESTAURANT") {
      return res.status(403).json({ error: "Rechnungsversand nur fuer Baecker und Metzger." });
    }

    const month = parseInvoiceMonth(req.body.month);
    if (!month) {
      return res.status(400).json({ error: "Monat ungueltig." });
    }

    const company = await prisma.company.findUnique({
      where: { id: req.body.companyId },
      select: { id: true, name: true }
    });
    if (!company) {
      return res.status(404).json({ error: "Firma nicht gefunden." });
    }

    const link = await prisma.vendorCompany.findUnique({
      where: {
        vendorId_companyId: {
          vendorId: vendor.id,
          companyId: company.id
        }
      },
      select: { status: true }
    });
    if (!link || link.status !== "APPROVED") {
      return res.status(403).json({ error: "Firma ist fuer diesen Anbieter nicht freigeschaltet." });
    }

    const monthStart = month.startOf("month");
    const monthEnd = monthStart.plus({ months: 1 });
    const periodMonth = monthStart.toUTC().toJSDate();

    const existing = await prisma.companyInvoice.findUnique({
      where: {
        vendorId_companyId_periodMonth: {
          vendorId: vendor.id,
          companyId: company.id,
          periodMonth
        }
      }
    });

    if (existing) {
      return res.status(409).json({ error: "Rechnung fuer diese Firma und diesen Monat wurde bereits gesendet." });
    }

    const orders = await prisma.order.findMany({
      where: {
        vendorId: vendor.id,
        user: { companyId: company.id },
        createdAt: {
          gte: monthStart.toUTC().toJSDate(),
          lt: monthEnd.toUTC().toJSDate()
        }
      },
      include: {
        items: true,
        user: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    if (orders.length === 0) {
      return res.status(404).json({ error: "Keine Bestellungen fuer diese Firma im gewaehlten Monat." });
    }

    const summary = summarizeInvoiceOrders(orders);
    const invoiceNo = `INV-${monthStart.toFormat("yyyyMM")}-${company.id.slice(0, 6).toUpperCase()}`;

    const pdfBuffer = await buildCompanyInvoicePdf({
      invoiceNo,
      vendorName: vendor.name,
      companyName: company.name,
      periodLabel: monthStart.toFormat("LLLL yyyy"),
      employeeRows: summary.employeeRows,
      orderRows: summary.orderRows,
      totalOrders: summary.totalOrders,
      totalPositions: summary.totalPositions,
      totalAmount: summary.totalAmount,
      averageAmount: summary.averageAmount
    });

    await fs.mkdir(COMPANY_INVOICE_ROOT, { recursive: true });

    const safeVendor = sanitizeFileToken(vendor.name);
    const safeCompany = sanitizeFileToken(company.name);
    const storedFileName = `${monthStart.toFormat("yyyy-MM")}-${safeVendor}-${vendor.id.slice(
      0,
      6
    )}-${safeCompany}-${company.id.slice(0, 6)}.pdf`;
    const storedPath = storedFileName;
    const absolutePath = resolveStoredInvoicePath(storedPath);
    await fs.writeFile(absolutePath, pdfBuffer);

    try {
      const created = await prisma.companyInvoice.create({
        data: {
          vendorId: vendor.id,
          companyId: company.id,
          periodMonth,
          invoiceNo,
          vendorNameSnapshot: vendor.name,
          companyNameSnapshot: company.name,
          employeeBreakdown: summary.employeeRows as Prisma.InputJsonValue,
          ordersCount: summary.totalOrders,
          positionsCount: summary.totalPositions,
          totalAmount: summary.totalAmount,
          pdfPath: storedPath,
          sentAt: new Date()
        }
      });

      return res.status(201).json({
        id: created.id,
        companyId: created.companyId,
        companyName: created.companyNameSnapshot,
        invoiceNo: created.invoiceNo,
        month: monthStart.toFormat("yyyy-MM"),
        totalAmount: Number(created.totalAmount),
        ordersCount: created.ordersCount,
        positionsCount: created.positionsCount,
        sentAt: created.sentAt
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(409).json({ error: "Rechnung fuer diese Firma und diesen Monat wurde bereits gesendet." });
      }
      throw error;
    }
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
      return res.status(400).json({ error: "Datum ungueltig." });
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
          select: {
            id: true,
            name: true,
            company: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    if (orders.length === 0) {
      return res.status(404).json({ error: "Keine Bestellungen fuer diese Firma im gewaehlten Monat." });
    }

    const companyName = orders[0].user.company?.name ?? "Firma";
    const summary = summarizeInvoiceOrders(orders);
    const invoiceNo = `INV-${resolved.batchDate.toFormat("yyyyMM")}-${query.companyId
      .slice(0, 6)
      .toUpperCase()}`;

    const pdfBuffer = await buildCompanyInvoicePdf({
      invoiceNo,
      vendorName: vendor.name,
      companyName,
      periodLabel: resolved.batchDate.toFormat("LLLL yyyy"),
      employeeRows: summary.employeeRows,
      orderRows: summary.orderRows,
      totalOrders: summary.totalOrders,
      totalPositions: summary.totalPositions,
      totalAmount: summary.totalAmount,
      averageAmount: summary.averageAmount
    });

    const safeCompany = sanitizeFileToken(companyName);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"rechnung-${safeCompany}-${resolved.batchDate.toFormat("yyyy-MM")}.pdf\"`
    );

    return res.send(pdfBuffer);
  })
);

router.get(
  "/vendor/invoices/:id/download",
  authRequired,
  asyncHandler(async (req, res) => {
    const invoice = await prisma.companyInvoice.findUnique({
      where: { id: req.params.id },
      include: {
        vendor: {
          select: {
            ownerUserId: true
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: "Rechnung nicht gefunden." });
    }

    if (req.user?.role === "VENDOR") {
      if (invoice.vendor.ownerUserId !== req.user.userId) {
        return res.status(403).json({ error: "Keine Berechtigung." });
      }
    } else if (req.user?.role === "COMPANY") {
      if (!req.user.companyId || req.user.companyId !== invoice.companyId) {
        return res.status(403).json({ error: "Keine Berechtigung." });
      }
    } else {
      return res.status(403).json({ error: "Keine Berechtigung." });
    }

    const absolutePath = resolveStoredInvoicePath(invoice.pdfPath);

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(absolutePath);
    } catch {
      return res.status(404).json({ error: "Rechnungsdatei nicht gefunden." });
    }

    const month = DateTime.fromJSDate(invoice.periodMonth, { zone: TIMEZONE }).toFormat("yyyy-MM");
    const safeCompany = sanitizeFileToken(invoice.companyNameSnapshot);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"rechnung-${safeCompany}-${month}.pdf\"`
    );

    return res.send(fileBuffer);
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
