import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { authRequired, requireRole, optionalAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { validateQuery } from "../utils/validation";

const router = Router();

const listSchema = z.object({
  q: z.string().optional(),
  type: z.enum(["BAECKER", "METZGER", "RESTAURANT"]).optional()
});

type VendorListQuery = z.infer<typeof listSchema>;

const buildWhere = (q?: string, type?: VendorListQuery["type"]): Prisma.VendorWhereInput => ({
  type: type ?? undefined,
  name: q ? { contains: q, mode: "insensitive" } : undefined
});

router.get(
  "/public",
  validateQuery(listSchema),
  asyncHandler(async (req, res) => {
    const { q, type } = req.query as VendorListQuery;
    const vendors = await prisma.vendor.findMany({
      where: {
        ...buildWhere(q, type),
        visibility: "PUBLIC",
        partnership: "PARTNER"
      },
      orderBy: { name: "asc" }
    });
    return res.json(vendors);
  })
);

router.get(
  "/company",
  authRequired,
  requireRole("CUSTOMER"),
  validateQuery(listSchema),
  asyncHandler(async (req, res) => {
    if (req.user?.customerType !== "EMPLOYEE") {
      return res.status(403).json({ error: "Nur für Mitarbeiter." });
    }
    if (!req.user.companyId) {
      return res.status(400).json({ error: "Keine Firmen-Zuordnung." });
    }
    const { q, type } = req.query as VendorListQuery;
    const vendors = await prisma.vendor.findMany({
      where: {
        ...buildWhere(q, type),
        companyLinks: {
          some: {
            companyId: req.user.companyId,
            status: "APPROVED"
          }
        },
        partnership: "PARTNER"
      },
      orderBy: { name: "asc" }
    });
    return res.json(vendors);
  })
);

router.get(
  "/",
  validateQuery(listSchema),
  asyncHandler(async (req, res) => {
    const { q, type } = req.query as VendorListQuery;
    const vendors = await prisma.vendor.findMany({
      where: {
        ...buildWhere(q, type),
        visibility: "PUBLIC",
        partnership: "PARTNER"
      },
      orderBy: { name: "asc" }
    });
    return res.json(vendors);
  })
);

router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const vendor = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      include: {
        products: {
          where: { active: true },
          orderBy: [{ category: "asc" }, { name: "asc" }]
        }
      }
    });
    if (!vendor) {
      return res.status(404).json({ error: "Anbieter nicht gefunden." });
    }
    if (vendor.visibility === "COMPANY_ONLY") {
      if (!req.user || req.user.customerType !== "EMPLOYEE") {
        return res.status(403).json({ error: "Nur für Firmen-Mitarbeiter." });
      }
      if (!req.user.companyId) {
        return res.status(403).json({ error: "Keine Berechtigung." });
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
    return res.json(vendor);
  })
);

export default router;
