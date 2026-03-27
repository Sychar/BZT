import { Router } from "express";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import multer from "multer";
import * as XLSX from "xlsx";
import { prisma } from "../prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../utils/validation";
import { authRequired, requireRole } from "../middleware/auth";

const router = Router();

const priceSchema = z.union([z.number(), z.string()]).transform((value) => Number(value));

const createSchema = z.object({
  name: z.string().min(2),
  category: z.enum(["BROT", "BELAG", "GETRAENK", "FLEISCH", "WURST", "SONSTIGES"]),
  price: priceSchema.refine((val) => Number.isFinite(val) && val >= 0, "Ungültiger Preis"),
  unit: z.string().min(1),
  active: z.boolean().optional(),
  imageUrl: z.string().url().optional().nullable(),
  isPromo: z.boolean().optional()
});

const updateSchema = createSchema.partial();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/^\ufeff/, "")
    .toLowerCase();

const parsePrice = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  let normalized = raw.replace(/\s/g, "").replace(/€/g, "");
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const MENU_UPLOAD_ROOT = path.resolve(process.cwd(), "apps/api/uploads/vendor-menus");
const MENU_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

const sanitizeFileName = (raw: string) =>
  raw.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");

const escapeRegex = (raw: string) =>
  raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getOwnedVendor = async (vendorId: string, userId?: string) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) {
    return { ok: false as const, status: 404, error: "Anbieter nicht gefunden." };
  }
  if (vendor.ownerUserId !== userId) {
    return { ok: false as const, status: 403, error: "Keine Berechtigung." };
  }
  return { ok: true as const, vendor };
};

router.post(
  "/vendors/:id/products",
  authRequired,
  requireRole("VENDOR"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({ where: { id: req.params.id } });
    if (!vendor) {
      return res.status(404).json({ error: "Anbieter nicht gefunden." });
    }
    if (vendor.ownerUserId !== req.user?.userId) {
      return res.status(403).json({ error: "Keine Berechtigung." });
    }
    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        name: req.body.name,
        category: req.body.category,
        price: req.body.price,
        unit: req.body.unit,
        active: req.body.active ?? undefined,
        imageUrl: req.body.imageUrl ?? null,
        isPromo: req.body.isPromo ?? undefined
      }
    });
    return res.status(201).json(product);
  })
);

router.get(
  "/vendor/products",
  authRequired,
  requireRole("VENDOR"),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }
    const products = await prisma.product.findMany({
      where: { vendorId },
      orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }]
    });
    return res.json(products);
  })
);

router.get(
  "/vendor/products/menu-uploads",
  authRequired,
  requireRole("VENDOR"),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }

    const ownership = await getOwnedVendor(vendorId, req.user?.userId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ error: ownership.error });
    }

    await fs.mkdir(MENU_UPLOAD_ROOT, { recursive: true });
    const files = await fs.readdir(MENU_UPLOAD_ROOT);
    const pattern = new RegExp(`^${escapeRegex(vendorId)}-(\\d+)-(.+)$`);

    const uploads = files
      .map((fileName) => {
        const match = fileName.match(pattern);
        if (!match) return null;
        const timestamp = Number(match[1]);
        if (!Number.isFinite(timestamp)) return null;
        return {
          id: fileName,
          fileName,
          originalName: match[2],
          uploadedAt: new Date(timestamp).toISOString()
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => !!entry)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));

    return res.json(uploads);
  })
);

router.post(
  "/vendor/products/menu-upload",
  authRequired,
  requireRole("VENDOR"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }

    const ownership = await getOwnedVendor(vendorId, req.user?.userId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ error: ownership.error });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "Bitte PDF oder Bild auswählen." });
    }

    const extension = path.extname(file.originalname).toLowerCase();
    if (!MENU_EXTENSIONS.has(extension)) {
      return res.status(400).json({ error: "Nur PDF, PNG, JPG, JPEG oder WEBP erlaubt." });
    }

    await fs.mkdir(MENU_UPLOAD_ROOT, { recursive: true });

    const safeOriginalName = sanitizeFileName(file.originalname);
    const timestamp = Date.now();
    const fileName = `${vendorId}-${timestamp}-${safeOriginalName}`;
    const fullPath = path.join(MENU_UPLOAD_ROOT, fileName);
    await fs.writeFile(fullPath, file.buffer);

    return res.status(201).json({
      id: fileName,
      fileName,
      originalName: safeOriginalName,
      uploadedAt: new Date(timestamp).toISOString(),
      size: file.size
    });
  })
);

router.post(
  "/vendor/products/import",
  authRequired,
  requireRole("VENDOR"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ error: "Anbieter nicht gefunden." });
    }
    if (vendor.ownerUserId !== req.user?.userId) {
      return res.status(403).json({ error: "Keine Berechtigung." });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "Bitte eine Excel-Datei hochladen." });
    }
    if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
      return res.status(400).json({ error: "Nur .xlsx Dateien sind erlaubt." });
    }

    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return res.status(400).json({ error: "Die Datei enthält kein Tabellenblatt." });
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    if (rows.length === 0) {
      return res.status(400).json({ error: "Die Datei ist leer." });
    }

    const header = rows[0];
    const nameColumn = header.findIndex((cell) => normalizeHeader(cell) === "name");
    const priceColumn = header.findIndex((cell) => normalizeHeader(cell) === "preis");

    if (nameColumn === -1 || priceColumn === -1) {
      return res.status(400).json({ error: "Spalten 'Name' und 'Preis' sind erforderlich." });
    }

    const existingProducts = await prisma.product.findMany({
      where: { vendorId },
      select: { name: true }
    });

    const knownNames = new Set(existingProducts.map((item) => item.name.trim().toLowerCase()));
    const productsToCreate: Array<{
      vendorId: string;
      name: string;
      category: "BROT";
      price: number;
      unit: "Stk";
      isPromo: false;
    }> = [];

    const errorRows: Array<{ row: number; reason: string }> = [];
    let skippedCount = 0;

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rawName = String(row[nameColumn] ?? "").trim();
      const rawPrice = row[priceColumn];
      const emptyRow = !rawName && String(rawPrice ?? "").trim() === "";
      if (emptyRow) continue;

      if (!rawName) {
        errorRows.push({ row: rowIndex + 1, reason: "Name fehlt." });
        continue;
      }

      const normalizedName = rawName.toLowerCase();
      if (knownNames.has(normalizedName)) {
        skippedCount += 1;
        continue;
      }

      const price = parsePrice(rawPrice);
      if (price === null) {
        errorRows.push({ row: rowIndex + 1, reason: "Preis ungültig." });
        continue;
      }

      knownNames.add(normalizedName);
      productsToCreate.push({
        vendorId,
        name: rawName,
        category: "BROT",
        price,
        unit: "Stk",
        isPromo: false
      });
    }

    if (productsToCreate.length > 0) {
      await prisma.product.createMany({ data: productsToCreate });
    }

    return res.status(201).json({
      importedCount: productsToCreate.length,
      skippedCount,
      errorRows
    });
  })
);

router.put(
  "/products/:id",
  authRequired,
  requireRole("VENDOR"),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: { vendor: true }
    });
    if (!product) {
      return res.status(404).json({ error: "Produkt nicht gefunden." });
    }
    if (product.vendor.ownerUserId !== req.user?.userId) {
      return res.status(403).json({ error: "Keine Berechtigung." });
    }
    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        name: req.body.name ?? undefined,
        category: req.body.category ?? undefined,
        price: req.body.price ?? undefined,
        unit: req.body.unit ?? undefined,
        active: req.body.active ?? undefined,
        imageUrl: req.body.imageUrl ?? undefined,
        isPromo: req.body.isPromo ?? undefined
      }
    });
    return res.json(updated);
  })
);

export default router;
