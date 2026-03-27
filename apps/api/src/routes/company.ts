import { Router } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { authRequired, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody, validateQuery } from "../utils/validation";
import { TIMEZONE } from "../utils/time";

const router = Router();

const dateQuerySchema = z.object({
  date: z.string().optional()
});

const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
});

const createEmployeeSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

const employeeCredentialsPdfSchema = z.object({
  employeeId: z.string().uuid(),
  password: z.string().min(6)
});

const FOOD_VENDOR_TYPES = ["BAECKER", "METZGER"] as const;

type CompanyGuard =
  | { ok: true; companyId: string }
  | { ok: false; error: string };

type CompanyOrderRecord = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: true } };
    vendor: true;
    user: true;
  };
}>;

const parseDate = (value?: string) => {
  if (!value) {
    return DateTime.now().setZone(TIMEZONE).startOf("day");
  }
  const parsed = DateTime.fromISO(value, { zone: TIMEZONE }).startOf("day");
  if (!parsed.isValid) {
    return null;
  }
  return parsed;
};

const parseMonth = (value?: string) => {
  if (!value) {
    return DateTime.now().setZone(TIMEZONE).startOf("month");
  }
  const parsed = DateTime.fromFormat(value, "yyyy-MM", { zone: TIMEZONE }).startOf("month");
  if (!parsed.isValid) {
    return null;
  }
  return parsed;
};

const getCompanyId = (companyId?: string | null): CompanyGuard => {
  if (!companyId) {
    return { ok: false, error: "Keine Firmen-Zuordnung." };
  }
  return { ok: true, companyId };
};

const buildOrdersWhere = (
  companyId: string,
  start?: DateTime,
  end?: DateTime
): Prisma.OrderWhereInput => {
  const where: Prisma.OrderWhereInput = {
    user: { companyId },
    vendor: { is: { type: { in: [...FOOD_VENDOR_TYPES] } } }
  };

  if (start && end) {
    where.createdAt = {
      gte: start.toUTC().toJSDate(),
      lt: end.toUTC().toJSDate()
    };
  }

  return where;
};

const buildOrdersForDate = async (companyId: string, date: DateTime) => {
  const start = date.startOf("day");
  const end = start.plus({ days: 1 });
  const orders = await prisma.order.findMany({
    where: buildOrdersWhere(companyId, start, end),
    include: {
      items: { include: { product: true } },
      vendor: true,
      user: true
    },
    orderBy: { createdAt: "asc" }
  });
  return { start, end, orders };
};

const buildOrdersForMonth = async (companyId: string, month: DateTime) => {
  const start = month.startOf("month");
  const end = start.plus({ months: 1 });
  const orders = await prisma.order.findMany({
    where: buildOrdersWhere(companyId, start, end),
    include: {
      items: { include: { product: true } },
      vendor: true,
      user: true
    },
    orderBy: { createdAt: "asc" }
  });
  return { start, end, orders };
};

const summarizeOrders = (orders: CompanyOrderRecord[]) => {
  const mapped = orders.map((order) => {
    const total = order.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.qty,
      0
    );
    return {
      id: order.id,
      createdAt: order.createdAt,
      pickupWindow: order.pickupWindow,
      status: order.status,
      vendorName: order.vendor.name,
      vendorType: order.vendor.type,
      employeeName: order.user.name,
      total,
      items: order.items.map((item) => ({
        name: item.product.name,
        qty: item.qty,
        unitPrice: Number(item.unitPrice)
      }))
    };
  });
  const totalCost = mapped.reduce((sum, order) => sum + order.total, 0);
  return { mapped, totalCost };
};

const summarizeInvoicesByVendor = (orders: CompanyOrderRecord[]) => {
  const vendorMap = new Map<
    string,
    {
      vendorId: string;
      vendorName: string;
      vendorType: string;
      ordersCount: number;
      positionsCount: number;
      totalAmount: number;
    }
  >();

  let positionsCount = 0;
  let totalAmount = 0;

  for (const order of orders) {
    const orderPositions = order.items.reduce((sum, item) => sum + item.qty, 0);
    const orderTotal = order.items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.qty,
      0
    );

    positionsCount += orderPositions;
    totalAmount += orderTotal;

    const existing = vendorMap.get(order.vendor.id);
    if (existing) {
      existing.ordersCount += 1;
      existing.positionsCount += orderPositions;
      existing.totalAmount += orderTotal;
    } else {
      vendorMap.set(order.vendor.id, {
        vendorId: order.vendor.id,
        vendorName: order.vendor.name,
        vendorType: order.vendor.type,
        ordersCount: 1,
        positionsCount: orderPositions,
        totalAmount: orderTotal
      });
    }
  }

  const vendors = Array.from(vendorMap.values()).sort((a, b) =>
    a.vendorName.localeCompare(b.vendorName, "de")
  );

  return {
    ordersCount: orders.length,
    positionsCount,
    totalAmount,
    vendors
  };
};

const csvEscape = (value: string | number | null) => {
  const raw = value === null ? "" : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const generateInviteCode = () => {
  const chunk = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `INV-${chunk}`;
};

const buildCredentialsPdf = (params: {
  companyName: string;
  companyCode: string;
  employeeName: string;
  employeeEmail: string;
  password: string;
}) =>
  new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("B·Z·T Mitarbeiter-Zugangsdaten");
    doc.moveDown();
    doc.fontSize(12).text(`Firma: ${params.companyName}`);
    doc.text(`Firmen-Code: ${params.companyCode}`);
    doc.moveDown();
    doc.text(`Name: ${params.employeeName}`);
    doc.text(`E-Mail: ${params.employeeEmail}`);
    doc.text(`Passwort: ${params.password}`);
    doc.moveDown();
    doc
      .fontSize(10)
      .text(
        "Hinweis: Diese Zugangsdaten vertraulich behandeln und nach erstem Login Passwort ändern."
      );

    doc.end();
  });

router.get(
  "/dashboard",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    const guard = getCompanyId(req.user?.companyId);
    if (!guard.ok) {
      return res.status(400).json({ error: guard.error });
    }

    const company = await prisma.company.findUnique({
      where: { id: guard.companyId }
    });
    if (!company) {
      return res.status(404).json({ error: "Firma nicht gefunden." });
    }

    const employeeCount = await prisma.user.count({
      where: {
        role: "CUSTOMER",
        customerType: "EMPLOYEE",
        companyId: guard.companyId
      }
    });

    const ordersWhere = buildOrdersWhere(guard.companyId);
    const ordersCount = await prisma.order.count({ where: ordersWhere });
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: ordersWhere
      },
      select: {
        qty: true,
        unitPrice: true
      }
    });

    const totalCost = orderItems.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.qty,
      0
    );

    const recentOrdersRaw = await prisma.order.findMany({
      where: ordersWhere,
      include: {
        items: true,
        vendor: true,
        user: true
      },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    const recentOrders = recentOrdersRaw.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      vendorName: order.vendor.name,
      employeeName: order.user.name,
      total: order.items.reduce(
        (inner, item) => inner + Number(item.unitPrice) * item.qty,
        0
      )
    }));

    return res.json({
      company: {
        id: company.id,
        name: company.name,
        code: company.code,
        isActive: company.isActive
      },
      employeeCount,
      ordersCount,
      totalCost,
      recentOrders
    });
  })
);

router.get(
  "/employees",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    const guard = getCompanyId(req.user?.companyId);
    if (!guard.ok) {
      return res.status(400).json({ error: guard.error });
    }

    const employees = await prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        customerType: "EMPLOYEE",
        companyId: guard.companyId
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    return res.json(employees);
  })
);

router.post(
  "/employees",
  authRequired,
  requireRole("COMPANY"),
  validateBody(createEmployeeSchema),
  asyncHandler(async (req, res) => {
    const guard = getCompanyId(req.user?.companyId);
    if (!guard.ok) {
      return res.status(400).json({ error: guard.error });
    }

    const { name, email, password } = req.body;

    const company = await prisma.company.findUnique({
      where: { id: guard.companyId },
      select: {
        id: true,
        name: true,
        code: true
      }
    });
    if (!company) {
      return res.status(404).json({ error: "Firma nicht gefunden." });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });
    if (existingUser) {
      return res.status(400).json({ error: "E-Mail ist bereits vergeben." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const employee = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "CUSTOMER",
        customerType: "EMPLOYEE",
        companyId: company.id
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    });

    return res.status(201).json({
      ...employee,
      companyCode: company.code
    });
  })
);

router.post(
  "/employees/credentials-pdf",
  authRequired,
  requireRole("COMPANY"),
  validateBody(employeeCredentialsPdfSchema),
  asyncHandler(async (req, res) => {
    const guard = getCompanyId(req.user?.companyId);
    if (!guard.ok) {
      return res.status(400).json({ error: guard.error });
    }

    const { employeeId, password } = req.body;

    const [company, employee] = await Promise.all([
      prisma.company.findUnique({
        where: { id: guard.companyId },
        select: {
          id: true,
          name: true,
          code: true
        }
      }),
      prisma.user.findFirst({
        where: {
          id: employeeId,
          role: "CUSTOMER",
          customerType: "EMPLOYEE",
          companyId: guard.companyId
        },
        select: {
          id: true,
          name: true,
          email: true
        }
      })
    ]);

    if (!company) {
      return res.status(404).json({ error: "Firma nicht gefunden." });
    }
    if (!employee) {
      return res.status(404).json({ error: "Mitarbeiter nicht gefunden." });
    }

    const pdfBuffer = await buildCredentialsPdf({
      companyName: company.name,
      companyCode: company.code,
      employeeName: employee.name,
      employeeEmail: employee.email,
      password
    });

    const safeName = employee.name
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "")
      .toLowerCase();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"zugangsdaten-${safeName || "mitarbeiter"}.pdf\"`
    );

    return res.send(pdfBuffer);
  })
);

router.get(
  "/suppliers",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    const guard = getCompanyId(req.user?.companyId);
    if (!guard.ok) {
      return res.status(400).json({ error: guard.error });
    }

    const links = await prisma.vendorCompany.findMany({
      where: { companyId: guard.companyId },
      include: { vendor: true },
      orderBy: [{ requestedAt: "desc" }]
    });

    return res.json(
      links.map((link) => ({
        vendorId: link.vendorId,
        vendorName: link.vendor.name,
        vendorType: link.vendor.type,
        status: link.status,
        requestedAt: link.requestedAt,
        approvedAt: link.approvedAt
      }))
    );
  })
);

router.get(
  "/invoices",
  authRequired,
  requireRole("COMPANY"),
  validateQuery(monthQuerySchema),
  asyncHandler(async (req, res) => {
    const guard = getCompanyId(req.user?.companyId);
    if (!guard.ok) {
      return res.status(400).json({ error: guard.error });
    }

    const monthParam = (req.query as { month?: string }).month;
    const month = parseMonth(monthParam);
    if (!month) {
      return res.status(400).json({ error: "Monat ungültig." });
    }

    const { start, end, orders } = await buildOrdersForMonth(guard.companyId, month);
    const summary = summarizeInvoicesByVendor(orders);

    return res.json({
      month: start.toFormat("yyyy-MM"),
      rangeStart: start.toISO(),
      rangeEnd: end.toISO(),
      ordersCount: summary.ordersCount,
      positionsCount: summary.positionsCount,
      totalAmount: summary.totalAmount,
      vendors: summary.vendors
    });
  })
);

router.get(
  "/invoices/export",
  authRequired,
  requireRole("COMPANY"),
  validateQuery(monthQuerySchema),
  asyncHandler(async (req, res) => {
    const guard = getCompanyId(req.user?.companyId);
    if (!guard.ok) {
      return res.status(400).json({ error: guard.error });
    }

    const monthParam = (req.query as { month?: string }).month;
    const month = parseMonth(monthParam);
    if (!month) {
      return res.status(400).json({ error: "Monat ungültig." });
    }

    const { start, orders } = await buildOrdersForMonth(guard.companyId, month);
    const summary = summarizeInvoicesByVendor(orders);

    const header = [
      "Monat",
      "Lieferant",
      "Typ",
      "Bestellungen",
      "Positionen",
      "Gesamtbetrag"
    ];

    const rows = [header.join(";")];

    summary.vendors.forEach((vendor) => {
      rows.push(
        [
          start.toFormat("yyyy-MM"),
          vendor.vendorName,
          vendor.vendorType,
          vendor.ordersCount,
          vendor.positionsCount,
          vendor.totalAmount.toFixed(2)
        ]
          .map(csvEscape)
          .join(";")
      );
    });

    rows.push(
      [
        start.toFormat("yyyy-MM"),
        "Gesamt",
        "",
        summary.ordersCount,
        summary.positionsCount,
        summary.totalAmount.toFixed(2)
      ]
        .map(csvEscape)
        .join(";")
    );

    const csv = `\uFEFF${rows.join("\n")}`;
    const fileMonth = start.toFormat("yyyy-MM");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"company-invoices-${fileMonth}.csv\"`
    );

    return res.send(csv);
  })
);

router.get(
  "/orders",
  authRequired,
  requireRole("COMPANY"),
  validateQuery(dateQuerySchema),
  asyncHandler(async (req, res) => {
    const guard = getCompanyId(req.user?.companyId);
    if (!guard.ok) {
      return res.status(400).json({ error: guard.error });
    }

    const dateParam = (req.query as { date?: string }).date;
    const date = parseDate(dateParam);
    if (!date) {
      return res.status(400).json({ error: "Datum ungültig." });
    }

    const { start, end, orders } = await buildOrdersForDate(guard.companyId, date);
    const { mapped, totalCost } = summarizeOrders(orders);

    return res.json({
      date: date.toISODate(),
      rangeStart: start.toISO(),
      rangeEnd: end.toISO(),
      ordersCount: mapped.length,
      totalCost,
      orders: mapped
    });
  })
);

router.get(
  "/orders/export",
  authRequired,
  requireRole("COMPANY"),
  validateQuery(dateQuerySchema),
  asyncHandler(async (req, res) => {
    const guard = getCompanyId(req.user?.companyId);
    if (!guard.ok) {
      return res.status(400).json({ error: guard.error });
    }

    const dateParam = (req.query as { date?: string }).date;
    const date = parseDate(dateParam);
    if (!date) {
      return res.status(400).json({ error: "Datum ungültig." });
    }

    const { orders } = await buildOrdersForDate(guard.companyId, date);
    const { mapped, totalCost } = summarizeOrders(orders);

    const header = [
      "OrderId",
      "Datum",
      "Anbieter",
      "Mitarbeiter",
      "Abholfenster",
      "Status",
      "Artikel",
      "Menge",
      "Einzelpreis",
      "Zeilensumme",
      "Bestellsumme"
    ];

    const rows = [header.join(",")];

    mapped.forEach((order) => {
      order.items.forEach((item) => {
        const lineTotal = item.qty * item.unitPrice;
        rows.push(
          [
            order.id,
            DateTime.fromJSDate(order.createdAt, { zone: TIMEZONE }).toISODate(),
            order.vendorName,
            order.employeeName,
            order.pickupWindow,
            order.status,
            item.name,
            item.qty,
            item.unitPrice.toFixed(2),
            lineTotal.toFixed(2),
            order.total.toFixed(2)
          ]
            .map(csvEscape)
            .join(",")
        );
      });
    });

    rows.push(
      ["", "", "", "", "", "", "", "", "", "Gesamt", totalCost.toFixed(2)]
        .map(csvEscape)
        .join(",")
    );

    const fileDate = date.toISODate();
    const csv = `\uFEFF${rows.join("\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"company-orders-${fileDate}.csv\"`
    );
    return res.send(csv);
  })
);

router.get(
  "/invites",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    const guard = getCompanyId(req.user?.companyId);
    if (!guard.ok) {
      return res.status(400).json({ error: guard.error });
    }

    const invites = await prisma.companyInvite.findMany({
      where: { companyId: guard.companyId },
      orderBy: { createdAt: "desc" }
    });

    return res.json(
      invites.map((invite) => ({
        id: invite.id,
        code: invite.code,
        createdAt: invite.createdAt,
        usedAt: invite.usedAt,
        expiresAt: invite.expiresAt
      }))
    );
  })
);

router.post(
  "/invites",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    const guard = getCompanyId(req.user?.companyId);
    if (!guard.ok) {
      return res.status(400).json({ error: guard.error });
    }

    const invite = await prisma.companyInvite.create({
      data: {
        companyId: guard.companyId,
        code: generateInviteCode()
      }
    });

    return res.status(201).json({
      id: invite.id,
      code: invite.code,
      createdAt: invite.createdAt,
      usedAt: invite.usedAt,
      expiresAt: invite.expiresAt
    });
  })
);

router.get(
  "/vendor-requests",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (_req, res) => {
    return res.status(403).json({
      error: "Freigaben laufen nur über neutralen Admin."
    });
  })
);

router.post(
  "/vendor-requests/:vendorId/approve",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (_req, res) => {
    return res.status(403).json({
      error: "Freigaben laufen nur über neutralen Admin."
    });
  })
);

router.delete(
  "/vendor-requests/:vendorId",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (_req, res) => {
    return res.status(403).json({
      error: "Freigaben laufen nur über neutralen Admin."
    });
  })
);

export default router;
