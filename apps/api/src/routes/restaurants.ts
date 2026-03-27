import { Router } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import { prisma } from "../prisma";
import { authRequired, requireRole, optionalAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { TIMEZONE } from "../utils/time";
import { validateBody, validateQuery } from "../utils/validation";

const router = Router();

const dateQuerySchema = z.object({
  date: z.string().optional()
});

const orderSchema = z.object({
  pickupTime: z.string(),
  note: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        qty: z.number().int().min(1),
        itemNote: z.string().optional()
      })
    )
    .min(1)
});

const reservationSchema = z.object({
  reservationTime: z.string(),
  partySize: z.number().int().min(1),
  note: z.string().optional()
});

const parseDate = (value: string) => {
  const parsed = DateTime.fromISO(value, { zone: TIMEZONE }).startOf("day");
  if (!parsed.isValid) {
    return null;
  }
  return parsed;
};

const parseDateTime = (value: string) => {
  const parsed = DateTime.fromISO(value, { zone: TIMEZONE });
  if (!parsed.isValid) {
    return null;
  }
  return parsed;
};

type RestaurantGuard = {
  ok: boolean;
  vendor?: {
    id: string;
    type: string;
    visibility: string;
    partnership: string;
    supportsReservations: boolean;
  };
  error?: string;
};

const getRestaurant = async (vendorId: string): Promise<RestaurantGuard> => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) {
    return { ok: false, error: "Restaurant nicht gefunden." };
  }
  if (vendor.type !== "RESTAURANT") {
    return { ok: false, error: "Kein Restaurant." };
  }
  return {
    ok: true,
    vendor: {
      id: vendor.id,
      type: vendor.type,
      visibility: vendor.visibility,
      partnership: vendor.partnership,
      supportsReservations: vendor.supportsReservations
    }
  };
};

const hasCompanyAccess = async (
  vendor: { id: string; visibility: string },
  user?: { customerType?: string | null; companyId?: string | null }
) => {
  if (vendor.visibility !== "COMPANY_ONLY") {
    return true;
  }
  if (user?.customerType !== "EMPLOYEE" || !user.companyId) {
    return false;
  }
  const link = await prisma.vendorCompany.findUnique({
    where: {
      vendorId_companyId: {
        vendorId: vendor.id,
        companyId: user.companyId
      }
    }
  });
  return !!link && link.status === "APPROVED";
};

router.get(
  "/restaurants/:id/menus",
  optionalAuth,
  validateQuery(dateQuerySchema),
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const guard = await getRestaurant(vendorId);
    if (!guard.ok) {
      return res.status(404).json({ error: guard.error });
    }
    if (!(await hasCompanyAccess(guard.vendor, req.user))) {
      return res.status(403).json({ error: "Keine Berechtigung." });
    }

    const dateParam = (req.query as { date?: string }).date;
    const date = dateParam ? parseDate(dateParam) : DateTime.now().setZone(TIMEZONE).startOf("day");
    if (!date) {
      return res.status(400).json({ error: "Datum ungültig." });
    }
    const menus = await prisma.dailyMenu.findMany({
      where: {
        vendorId,
        date: date.toUTC().toJSDate(),
        active: true
      },
      include: {
        items: {
          where: { active: true },
          orderBy: { name: "asc" }
        },
        vendor: true
      },
      orderBy: { createdAt: "asc" }
    });
    return res.json(menus);
  })
);

router.get(
  "/feed/private",
  authRequired,
  requireRole("CUSTOMER"),
  validateQuery(dateQuerySchema),
  asyncHandler(async (req, res) => {
    if (req.user?.customerType !== "PRIVATE") {
      return res.status(403).json({ error: "Nur für private Nutzer." });
    }
    const dateParam = (req.query as { date?: string }).date;
    const date = dateParam ? parseDate(dateParam) : DateTime.now().setZone(TIMEZONE).startOf("day");
    if (!date) {
      return res.status(400).json({ error: "Datum ungültig." });
    }
    const menus = await prisma.dailyMenu.findMany({
      where: {
        date: date.toUTC().toJSDate(),
        active: true,
        vendor: {
          type: "RESTAURANT",
          visibility: "PUBLIC"
        }
      },
      include: {
        items: {
          where: { active: true },
          orderBy: { name: "asc" }
        },
        vendor: true
      },
      orderBy: { createdAt: "asc" }
    });
    return res.json(menus);
  })
);

router.post(
  "/restaurants/:id/orders",
  authRequired,
  requireRole("CUSTOMER"),
  validateBody(orderSchema),
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const guard = await getRestaurant(vendorId);
    if (!guard.ok) {
      return res.status(404).json({ error: guard.error });
    }
    if (!(await hasCompanyAccess(guard.vendor, req.user))) {
      return res.status(403).json({ error: "Keine Berechtigung." });
    }
    if (guard.vendor.partnership !== "PARTNER") {
      return res.status(403).json({ error: "Dieser Anbieter erlaubt keine Vorbestellung." });
    }
    const pickupTime = parseDateTime(req.body.pickupTime);
    if (!pickupTime) {
      return res.status(400).json({ error: "Uhrzeit ungültig." });
    }

    const menuItems = await prisma.dailyMenuItem.findMany({
      where: {
        id: { in: req.body.items.map((item: { menuItemId: string }) => item.menuItemId) },
        active: true,
        menu: { vendorId }
      },
      include: { menu: true }
    });
    if (menuItems.length !== req.body.items.length) {
      return res.status(400).json({ error: "Menü-Items ungültig." });
    }
    const menuMap = new Map(menuItems.map((item) => [item.id, item]));
    const order = await prisma.restaurantOrder.create({
      data: {
        userId: req.user!.userId,
        vendorId,
        pickupTime: pickupTime.toUTC().toJSDate(),
        note: req.body.note ?? null,
        items: {
          create: req.body.items.map((item: { menuItemId: string; qty: number; itemNote?: string }) => ({
            menuItemId: item.menuItemId,
            qty: item.qty,
            unitPrice: menuMap.get(item.menuItemId)!.price,
            itemNote: item.itemNote ?? null
          }))
        }
      },
      include: { items: true }
    });
    return res.status(201).json(order);
  })
);

router.post(
  "/restaurants/:id/reservations",
  authRequired,
  requireRole("CUSTOMER"),
  validateBody(reservationSchema),
  asyncHandler(async (req, res) => {
    const vendorId = req.params.id;
    const guard = await getRestaurant(vendorId);
    if (!guard.ok) {
      return res.status(404).json({ error: guard.error });
    }
    if (!(await hasCompanyAccess(guard.vendor, req.user))) {
      return res.status(403).json({ error: "Keine Berechtigung." });
    }
    if (!guard.vendor.supportsReservations || guard.vendor.partnership !== "PARTNER") {
      return res.status(403).json({ error: "Reservierung nicht verfügbar." });
    }
    const reservationTime = parseDateTime(req.body.reservationTime);
    if (!reservationTime) {
      return res.status(400).json({ error: "Uhrzeit ungültig." });
    }
    const reservation = await prisma.reservation.create({
      data: {
        userId: req.user!.userId,
        vendorId,
        reservationTime: reservationTime.toUTC().toJSDate(),
        partySize: req.body.partySize,
        note: req.body.note ?? null
      }
    });
    return res.status(201).json(reservation);
  })
);

export default router;
