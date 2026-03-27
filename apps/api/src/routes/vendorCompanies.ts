import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authRequired, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../utils/validation";

const router = Router();

const companySchema = z.object({
  companyCode: z.string().min(2)
});

router.get(
  "/companies",
  authRequired,
  requireRole("VENDOR"),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }
    const links = await prisma.vendorCompany.findMany({
      where: { vendorId },
      include: { company: true },
      orderBy: { createdAt: "asc" }
    });
    return res.json(
      links.map((link) => ({
        id: link.company.id,
        name: link.company.name,
        code: link.company.code,
        status: link.status,
        requestedAt: link.requestedAt,
        approvedAt: link.approvedAt
      }))
    );
  })
);

router.post(
  "/companies",
  authRequired,
  requireRole("VENDOR"),
  validateBody(companySchema),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }
    const { companyCode } = req.body;
    const company = await prisma.company.findUnique({
      where: { code: companyCode }
    });
    if (!company) {
      return res.status(400).json({ error: "Firmen-Code ungültig." });
    }
    const existing = await prisma.vendorCompany.findUnique({
      where: {
        vendorId_companyId: {
          vendorId,
          companyId: company.id
        }
      }
    });
    if (existing) {
      return res.json({
        id: company.id,
        name: company.name,
        code: company.code,
        status: existing.status,
        requestedAt: existing.requestedAt,
        approvedAt: existing.approvedAt
      });
    }

    const created = await prisma.vendorCompany.create({
      data: {
        vendorId,
        companyId: company.id,
        status: "PENDING"
      }
    });
    return res.status(201).json({
      id: company.id,
      name: company.name,
      code: company.code,
      status: created.status,
      requestedAt: created.requestedAt,
      approvedAt: created.approvedAt
    });
  })
);

router.delete(
  "/companies/:companyId",
  authRequired,
  requireRole("VENDOR"),
  asyncHandler(async (req, res) => {
    const vendorId = req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ error: "Kein Anbieterprofil." });
    }
    await prisma.vendorCompany.deleteMany({
      where: {
        vendorId,
        companyId: req.params.companyId
      }
    });
    return res.status(204).send();
  })
);

export default router;
