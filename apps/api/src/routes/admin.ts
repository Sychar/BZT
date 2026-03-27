import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../prisma";
import { authRequired, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../utils/validation";

const router = Router();

const ensureNeutralAdmin = (companyId?: string | null) => {
  return !companyId;
};

const createCompanySchema = z.object({
  companyName: z.string().min(2),
  companyCode: z.string().min(2).max(40).optional(),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6)
});

const assignLinkSchema = z.object({
  vendorId: z.string().uuid(),
  companyId: z.string().uuid()
});

const normalizeCodePrefix = (name: string) => {
  const cleaned = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 8) || "FIRMA";
};

const generateCodeCandidate = (prefix: string) => {
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${prefix}-${suffix}`;
};

const ensureUniqueCompanyCode = async (name: string, manualCode?: string) => {
  if (manualCode) {
    const normalized = manualCode.trim().toUpperCase();
    const existing = await prisma.company.findUnique({
      where: { code: normalized },
      select: { id: true }
    });
    if (existing) {
      throw new Error("Firmen-Code bereits vergeben.");
    }
    return normalized;
  }

  const prefix = normalizeCodePrefix(name);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = generateCodeCandidate(prefix);
    const existing = await prisma.company.findUnique({
      where: { code: candidate },
      select: { id: true }
    });
    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Firmen-Code konnte nicht erzeugt werden.");
};

const mapLink = (link: {
  vendorId: string;
  companyId: string;
  status: "PENDING" | "APPROVED";
  requestedAt: Date;
  approvedAt: Date | null;
  vendor: {
    name: string;
    type: string;
  };
  company: {
    name: string;
    code: string;
  };
}) => {
  return {
    vendorId: link.vendorId,
    vendorName: link.vendor.name,
    vendorType: link.vendor.type,
    companyId: link.companyId,
    companyName: link.company.name,
    companyCode: link.company.code,
    status: link.status,
    requestedAt: link.requestedAt,
    approvedAt: link.approvedAt
  };
};

router.get(
  "/dashboard",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    if (!ensureNeutralAdmin(req.user?.companyId)) {
      return res.status(403).json({ error: "Nur neutraler Admin darf Freigaben steuern." });
    }

    const [companies, vendors, links] = await Promise.all([
      prisma.company.findMany({
        include: {
          users: {
            where: { role: "COMPANY" },
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.vendor.findMany({
        where: {
          type: { in: ["BAECKER", "METZGER"] }
        },
        select: {
          id: true,
          name: true,
          type: true,
          address: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.vendorCompany.findMany({
        include: {
          vendor: { select: { name: true, type: true } },
          company: { select: { name: true, code: true } }
        },
        orderBy: [{ requestedAt: "desc" }]
      })
    ]);

    return res.json({
      companies: companies.map((company) => ({
        id: company.id,
        name: company.name,
        code: company.code,
        isActive: company.isActive,
        createdAt: company.createdAt,
        admins: company.users
      })),
      vendors,
      links: links.map(mapLink)
    });
  })
);

router.get(
  "/companies",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    if (!ensureNeutralAdmin(req.user?.companyId)) {
      return res.status(403).json({ error: "Nur neutraler Admin darf Firmen verwalten." });
    }

    const companies = await prisma.company.findMany({
      include: {
        users: {
          where: { role: "COMPANY" },
          select: { id: true, name: true, email: true, createdAt: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return res.json(
      companies.map((company) => ({
        id: company.id,
        name: company.name,
        code: company.code,
        isActive: company.isActive,
        activatedAt: company.activatedAt,
        createdAt: company.createdAt,
        admins: company.users
      }))
    );
  })
);

router.post(
  "/companies",
  authRequired,
  requireRole("COMPANY"),
  validateBody(createCompanySchema),
  asyncHandler(async (req, res) => {
    if (!ensureNeutralAdmin(req.user?.companyId)) {
      return res.status(403).json({ error: "Nur neutraler Admin darf Firmen verwalten." });
    }

    const { companyName, companyCode, adminName, adminEmail, adminPassword } = req.body;

    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true }
    });
    if (existingAdmin) {
      return res.status(400).json({ error: "E-Mail ist bereits vergeben." });
    }

    let code: string;
    try {
      code = await ensureUniqueCompanyCode(companyName, companyCode);
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const created = await prisma.company.create({
      data: {
        name: companyName,
        code,
        users: {
          create: {
            name: adminName,
            email: adminEmail,
            passwordHash,
            role: "COMPANY"
          }
        }
      },
      include: {
        users: {
          where: { role: "COMPANY" },
          select: { id: true, name: true, email: true, createdAt: true }
        }
      }
    });

    return res.status(201).json({
      id: created.id,
      name: created.name,
      code: created.code,
      isActive: created.isActive,
      activatedAt: created.activatedAt,
      createdAt: created.createdAt,
      admins: created.users
    });
  })
);

router.post(
  "/companies/:companyId/regenerate-code",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    if (!ensureNeutralAdmin(req.user?.companyId)) {
      return res.status(403).json({ error: "Nur neutraler Admin darf Firmen verwalten." });
    }

    const company = await prisma.company.findUnique({
      where: { id: req.params.companyId }
    });
    if (!company) {
      return res.status(404).json({ error: "Firma nicht gefunden." });
    }

    const code = await ensureUniqueCompanyCode(company.name);
    const updated = await prisma.company.update({
      where: { id: company.id },
      data: { code }
    });

    return res.json({
      id: updated.id,
      code: updated.code
    });
  })
);

router.get(
  "/vendors",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    if (!ensureNeutralAdmin(req.user?.companyId)) {
      return res.status(403).json({ error: "Nur neutraler Admin darf Lieferanten verwalten." });
    }

    const vendors = await prisma.vendor.findMany({
      where: {
        type: { in: ["BAECKER", "METZGER"] }
      },
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    return res.json(vendors);
  })
);

router.get(
  "/links",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    if (!ensureNeutralAdmin(req.user?.companyId)) {
      return res.status(403).json({ error: "Nur neutraler Admin darf Verbindungen verwalten." });
    }

    const links = await prisma.vendorCompany.findMany({
      include: {
        vendor: { select: { name: true, type: true } },
        company: { select: { name: true, code: true } }
      },
      orderBy: [{ requestedAt: "desc" }]
    });

    return res.json(links.map(mapLink));
  })
);

router.post(
  "/links",
  authRequired,
  requireRole("COMPANY"),
  validateBody(assignLinkSchema),
  asyncHandler(async (req, res) => {
    if (!ensureNeutralAdmin(req.user?.companyId)) {
      return res.status(403).json({ error: "Nur neutraler Admin darf Verbindungen verwalten." });
    }

    const { vendorId, companyId } = req.body;

    const [company, vendor] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }),
      prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true, type: true }
      })
    ]);

    if (!company) {
      return res.status(404).json({ error: "Firma nicht gefunden." });
    }
    if (!vendor || (vendor.type !== "BAECKER" && vendor.type !== "METZGER")) {
      return res.status(404).json({ error: "Lieferant nicht gefunden." });
    }

    const now = new Date();
    const link = await prisma.vendorCompany.upsert({
      where: {
        vendorId_companyId: {
          vendorId,
          companyId
        }
      },
      update: {
        status: "APPROVED",
        approvedAt: now
      },
      create: {
        vendorId,
        companyId,
        status: "APPROVED",
        approvedAt: now
      },
      include: {
        vendor: { select: { name: true, type: true } },
        company: { select: { name: true, code: true } }
      }
    });

    return res.status(201).json(mapLink(link));
  })
);

router.delete(
  "/links/:vendorId/:companyId",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    if (!ensureNeutralAdmin(req.user?.companyId)) {
      return res.status(403).json({ error: "Nur neutraler Admin darf Verbindungen verwalten." });
    }

    const { vendorId, companyId } = req.params;
    await prisma.vendorCompany.deleteMany({
      where: {
        vendorId,
        companyId
      }
    });

    return res.status(204).send();
  })
);

router.get(
  "/vendor-requests",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    if (!ensureNeutralAdmin(req.user?.companyId)) {
      return res.status(403).json({ error: "Nur neutraler Admin darf Freigaben steuern." });
    }

    const requests = await prisma.vendorCompany.findMany({
      where: { status: "PENDING" },
      include: {
        vendor: true,
        company: true
      },
      orderBy: { requestedAt: "desc" }
    });

    return res.json(requests.map(mapLink));
  })
);

router.post(
  "/vendor-requests/:vendorId/:companyId/approve",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    if (!ensureNeutralAdmin(req.user?.companyId)) {
      return res.status(403).json({ error: "Nur neutraler Admin darf Freigaben steuern." });
    }

    const { vendorId, companyId } = req.params;

    const link = await prisma.vendorCompany.findUnique({
      where: {
        vendorId_companyId: {
          vendorId,
          companyId
        }
      }
    });

    if (!link) {
      return res.status(404).json({ error: "Anfrage nicht gefunden." });
    }

    await prisma.vendorCompany.update({
      where: {
        vendorId_companyId: {
          vendorId,
          companyId
        }
      },
      data: {
        status: "APPROVED",
        approvedAt: new Date()
      }
    });

    const updated = await prisma.vendorCompany.findUnique({
      where: {
        vendorId_companyId: {
          vendorId,
          companyId
        }
      },
      include: {
        vendor: { select: { name: true, type: true } },
        company: { select: { name: true, code: true } }
      }
    });

    if (!updated) {
      return res.status(404).json({ error: "Anfrage nicht gefunden." });
    }

    return res.json(mapLink(updated));
  })
);

router.delete(
  "/vendor-requests/:vendorId/:companyId",
  authRequired,
  requireRole("COMPANY"),
  asyncHandler(async (req, res) => {
    if (!ensureNeutralAdmin(req.user?.companyId)) {
      return res.status(403).json({ error: "Nur neutraler Admin darf Freigaben steuern." });
    }

    const { vendorId, companyId } = req.params;

    const existing = await prisma.vendorCompany.findUnique({
      where: {
        vendorId_companyId: {
          vendorId,
          companyId
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: "Anfrage nicht gefunden." });
    }

    await prisma.vendorCompany.delete({
      where: {
        vendorId_companyId: {
          vendorId,
          companyId
        }
      }
    });

    return res.status(204).send();
  })
);

export default router;
