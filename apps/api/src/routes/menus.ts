import { Router } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import { prisma } from "../prisma";
import { authRequired, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { TIMEZONE } from "../utils/time";
import { validateBody, validateQuery } from "../utils/validation";

const router = Router();

const menuQuerySchema = z.object({
  date: z.string().optional()
});

const menuCreateSchema = z.object({
  date: z.string(),
  title: z.string().min(2),
  description: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(2),
        description: z.string().optional(),
        price: z.number().min(0)
      })
    )
    .optional()
});

const menuUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  date: z.string().optional()
});

const menuItemCreateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().min(0)
});

const menuItemUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  active: z.boolean().optional()
});

const parseDate = (value: string) => {
  const parsed = DateTime.fromISO(value, { zone: TIMEZONE }).startOf("day");
  if (!parsed.isValid) {
    return null;
  }
  return parsed;
};

const ensureRestaurantVendor = async (vendorId: string) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) {
    return { error: "Anbieter nicht gefunden." };
  }
  if (vendor.type !== "RESTAURANT") {
    return { error: "Nur Restaurants können Menüs verwalten." };
  }
  return { vendor };
};

router.get(
  "/vendor/menus",
  authRequired,
  requireRole("VENDOR"),
  validateQuery(menuQuerySchema),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }
    const guard = await ensureRestaurantVendor(vendorId);
    if (guard.error) {
      return res.status(403).json({ error: guard.error });
    }
    const dateParam = (req.query as { date?: string }).date;
    const date = dateParam
      ? parseDate(dateParam)
      : DateTime.now().setZone(TIMEZONE).startOf("day");
    if (!date) {
      return res.status(400).json({ error: "Datum ungültig." });
    }
    const menus = await prisma.dailyMenu.findMany({
      where: {
        vendorId,
        date: date.toUTC().toJSDate()
      },
      include: { items: true },
      orderBy: { createdAt: "asc" }
    });
    return res.json(menus);
  })
);

router.post(
  "/vendor/menus",
  authRequired,
  requireRole("VENDOR"),
  validateBody(menuCreateSchema),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }
    const guard = await ensureRestaurantVendor(vendorId);
    if (guard.error) {
      return res.status(403).json({ error: guard.error });
    }
    const date = parseDate(req.body.date);
    if (!date) {
      return res.status(400).json({ error: "Datum ungültig." });
    }
    const menu = await prisma.dailyMenu.create({
      data: {
        vendorId,
        date: date.toUTC().toJSDate(),
        title: req.body.title,
        description: req.body.description ?? null,
        items: req.body.items
          ? {
              create: req.body.items.map((item: { name: string; description?: string; price: number }) => ({
                name: item.name,
                description: item.description ?? null,
                price: item.price
              }))
            }
          : undefined
      },
      include: { items: true }
    });
    return res.status(201).json(menu);
  })
);

router.put(
  "/vendor/menus/:id",
  authRequired,
  requireRole("VENDOR"),
  validateBody(menuUpdateSchema),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }
    const menu = await prisma.dailyMenu.findUnique({ where: { id: req.params.id } });
    if (!menu || menu.vendorId !== vendorId) {
      return res.status(404).json({ error: "Menü nicht gefunden." });
    }
    const date = req.body.date ? parseDate(req.body.date) : null;
    if (req.body.date && !date) {
      return res.status(400).json({ error: "Datum ungültig." });
    }
    const updated = await prisma.dailyMenu.update({
      where: { id: menu.id },
      data: {
        title: req.body.title ?? undefined,
        description: req.body.description ?? undefined,
        active: req.body.active ?? undefined,
        date: date ? date.toUTC().toJSDate() : undefined
      }
    });
    return res.json(updated);
  })
);

router.post(
  "/vendor/menus/:id/items",
  authRequired,
  requireRole("VENDOR"),
  validateBody(menuItemCreateSchema),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }
    const menu = await prisma.dailyMenu.findUnique({ where: { id: req.params.id } });
    if (!menu || menu.vendorId !== vendorId) {
      return res.status(404).json({ error: "Menü nicht gefunden." });
    }
    const item = await prisma.dailyMenuItem.create({
      data: {
        menuId: menu.id,
        name: req.body.name,
        description: req.body.description ?? null,
        price: req.body.price
      }
    });
    return res.status(201).json(item);
  })
);

router.put(
  "/vendor/menu-items/:id",
  authRequired,
  requireRole("VENDOR"),
  validateBody(menuItemUpdateSchema),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }
    const item = await prisma.dailyMenuItem.findUnique({
      where: { id: req.params.id },
      include: { menu: true }
    });
    if (!item || item.menu.vendorId !== vendorId) {
      return res.status(404).json({ error: "Menü-Item nicht gefunden." });
    }
    const updated = await prisma.dailyMenuItem.update({
      where: { id: item.id },
      data: {
        name: req.body.name ?? undefined,
        description: req.body.description ?? undefined,
        price: req.body.price ?? undefined,
        active: req.body.active ?? undefined
      }
    });
    return res.json(updated);
  })
);

export default router;
