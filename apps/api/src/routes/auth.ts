import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../prisma";
import { env } from "../utils/env";
import { asyncHandler } from "../utils/asyncHandler";
import { validateBody } from "../utils/validation";
import { authRequired } from "../middleware/auth";

const router = Router();

const baseUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = baseUserSchema.extend({
  companyCode: z.string().min(2)
});

const registerVendorSchema = baseUserSchema.extend({
  vendor: z.object({
    name: z.string().min(2),
    type: z.enum(["BAECKER", "METZGER", "RESTAURANT"]),
    address: z.string().min(3),
    cutoffTime: z.string().optional(),
    visibility: z.enum(["PUBLIC", "COMPANY_ONLY"]).optional(),
    partnership: z.enum(["PARTNER", "AD_ONLY"]).optional(),
    companyCode: z.string().optional(),
    supportsReservations: z.boolean().optional()
  })
});

const registrationRequestSchema = z
  .object({
    requestType: z.enum(["COMPANY", "VENDOR"]),
    vendorType: z.enum(["BAECKER", "METZGER"]).optional(),
    businessName: z.string().min(2),
    contactName: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(5),
    address: z.string().min(5)
  })
  .superRefine((value, ctx) => {
    if (value.requestType === "VENDOR" && !value.vendorType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitte Lieferantentyp auswählen."
      });
    }
    if (value.requestType === "COMPANY" && value.vendorType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vendor-Typ ist nur für Lieferanten erlaubt."
      });
    }
  });

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  companyCode: z.string().min(2).optional(),
  internalCode: z.string().min(2).optional()
});

const changePasswordSchema = z.object({
  newEmail: z.string().min(1),
  newPassword: z.string().min(6)
});

const companyLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  companyCode: z.string().min(2)
});

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const signToken = (payload: {
  userId: string;
  name: string;
  role: "CUSTOMER" | "VENDOR" | "COMPANY";
  vendorId?: string | null;
  vendorType?: "BAECKER" | "METZGER" | "RESTAURANT" | null;
  customerType?: "EMPLOYEE" | "PRIVATE" | null;
  companyId?: string | null;
}) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });

router.post(
  "/registration-request",
  validateBody(registrationRequestSchema),
  asyncHandler(async (req, res) => {
    const {
      requestType,
      vendorType,
      businessName,
      contactName,
      email,
      phone,
      address
    } = req.body;

    const created = await prisma.registrationRequest.create({
      data: {
        requestType,
        vendorType: requestType === "VENDOR" ? vendorType : null,
        businessName,
        contactName,
        email,
        phone,
        address
      }
    });

    return res.status(201).json({
      id: created.id,
      status: created.status
    });
  })
);

router.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, companyCode } = req.body;
    const company = await prisma.company.findUnique({
      where: { code: companyCode }
    });
    if (!company) {
      return res.status(400).json({ error: "Firmen-Code ungültig." });
    }
    if (!company.isActive) {
      return res.status(403).json({ error: "Firma noch nicht aktiviert." });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "CUSTOMER",
        customerType: "EMPLOYEE",
        companyId: company.id
      }
    });
    const token = signToken({
      userId: user.id,
      name: user.name,
      role: user.role,
      customerType: user.customerType ? user.customerType : null,
      companyId: user.companyId ? user.companyId : null
    });
    return res.status(201).json({ token });
  })
);

router.post(
  "/register-vendor",
  validateBody(registerVendorSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, vendor } = req.body;
    let companyId: string | null = null;
    if (vendor.visibility === "COMPANY_ONLY") {
      if (!vendor.companyCode) {
        return res.status(400).json({ error: "Firmen-Code fehlt." });
      }
      const company = await prisma.company.findUnique({
        where: { code: vendor.companyCode }
      });
      if (!company) {
        return res.status(400).json({ error: "Firmen-Code ungültig." });
      }
      companyId = company.id;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "VENDOR",
        vendor: {
          create: {
            name: vendor.name,
            type: vendor.type,
            address: vendor.address,
            cutoffTime: vendor.cutoffTime ?? "04:00",
            visibility: vendor.visibility ?? "PUBLIC",
            partnership: vendor.partnership ?? "PARTNER",
            supportsReservations: vendor.supportsReservations ?? false,
            companyLinks: companyId
              ? {
                  create: {
                    companyId
                  }
                }
              : undefined
          }
        }
      },
      include: {
        vendor: true
      }
    });
    const token = signToken({
      userId: user.id,
      name: user.name,
      role: user.role,
      vendorId: user.vendor?.id ?? null,
      vendorType: user.vendor?.type ?? null
    });
    return res.status(201).json({ token, vendorId: user.vendor?.id ?? null });
  })
);

router.post(
  "/company/login",
  validateBody(companyLoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password, companyCode } = req.body;
    const company = await prisma.company.findUnique({
      where: { code: companyCode }
    });
    if (!company) {
      return res.status(401).json({ error: "Login fehlgeschlagen." });
    }
    const user = await prisma.user.findFirst({
      where: {
        email,
        role: "COMPANY",
        companyId: company.id
      }
    });
    if (!user) {
      return res.status(401).json({ error: "Login fehlgeschlagen." });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Login fehlgeschlagen." });
    }
    if (!company.isActive) {
      await prisma.company.update({
        where: { id: company.id },
        data: {
          isActive: true,
          activatedAt: new Date()
        }
      });
    }
    const token = signToken({
      userId: user.id,
      name: user.name,
      role: user.role,
      companyId: company.id
    });
    return res.json({ token, companyId: company.id });
  })
);

router.post(
  "/admin/login",
  validateBody(adminLoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findFirst({
      where: {
        email,
        role: "COMPANY",
        companyId: null
      }
    });
    if (!user) {
      return res.status(401).json({ error: "Login fehlgeschlagen." });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Login fehlgeschlagen." });
    }
    const token = signToken({
      userId: user.id,
      name: user.name,
      role: user.role,
      companyId: null
    });
    return res.json({ token });
  })
);

router.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password, companyCode, internalCode } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { vendor: true, company: true }
    });
    if (!user) {
      return res.status(401).json({ error: "Login fehlgeschlagen." });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Login fehlgeschlagen." });
    }
    if (user.role === "COMPANY") {
      return res.status(403).json({ error: "Bitte Firmen-Login nutzen." });
    }
    if (user.role === "CUSTOMER") {
      if (user.customerType !== "EMPLOYEE") {
        return res.status(403).json({ error: "Private Nutzer werden nicht mehr unterstützt." });
      }
      if (!user.companyId) {
        // Firma noch nicht verknüpft – kann über internalCode zugeordnet werden
        if (!internalCode) {
          return res.status(400).json({ error: "Firmen-Code oder interner Code fehlt." });
        }
        const company = await prisma.company.findUnique({
          where: { internalCode }
        });
        if (!company) {
          return res.status(401).json({ error: "Interner Firmen-Code ungültig." });
        }
        if (!company.isActive) {
          return res.status(403).json({ error: "Firma noch nicht aktiviert." });
        }
        await prisma.user.update({
          where: { id: user.id },
          data: { companyId: company.id }
        });
        user.companyId = company.id;
        user.company = company;
      } else if (internalCode) {
        // Login mit internem Code statt externem Code
        const company = await prisma.company.findUnique({
          where: { internalCode }
        });
        if (!company || company.id !== user.companyId) {
          return res.status(401).json({ error: "Interner Firmen-Code ungültig." });
        }
        if (!company.isActive) {
          return res.status(403).json({ error: "Firma noch nicht aktiviert." });
        }
      } else if (companyCode) {
        if (!user.company || user.company.code !== companyCode) {
          return res.status(401).json({ error: "Firmen-Code ungültig." });
        }
        if (!user.company.isActive) {
          return res.status(403).json({ error: "Firma noch nicht aktiviert." });
        }
      } else {
        return res.status(400).json({ error: "Firmen-Code oder interner Code fehlt." });
      }
    }
    const token = signToken({
      userId: user.id,
      name: user.name,
      role: user.role,
      vendorId: user.vendor?.id ?? null,
      vendorType: user.vendor?.type ?? null,
      customerType: user.customerType ? user.customerType : null,
      companyId: user.companyId ? user.companyId : null
    });
    const response: Record<string, unknown> = { token, vendorId: user.vendor?.id ?? null };
    if (user.mustChangePassword) {
      response.mustChangePassword = true;
    }
    return res.json(response);
  })
);

router.post(
  "/change-password",
  authRequired,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Nicht autorisiert." });
    }

    const { newEmail, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, mustChangePassword: true }
    });
    if (!user) {
      return res.status(404).json({ error: "Benutzer nicht gefunden." });
    }

    // Prüfen ob neuer Benutzername bereits vergeben (falls geändert)
    if (newEmail !== user.email) {
      const existing = await prisma.user.findUnique({
        where: { email: newEmail },
        select: { id: true }
      });
      if (existing) {
        return res.status(400).json({ error: "Benutzername bereits vergeben." });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        passwordHash,
        mustChangePassword: false,
        tempPassword: null
      }
    });

    return res.json({ ok: true });
  })
);

export default router;
