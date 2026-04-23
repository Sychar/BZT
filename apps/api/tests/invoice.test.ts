import path from "path";
import fs from "fs";
import request from "supertest";
import { DateTime } from "luxon";
import app from "../src/app";
import { prisma } from "../src/prisma";
import { signToken } from "./helpers";

const createInvoiceFixture = async () => {
  const suffix = Date.now().toString();

  const vendorUser = await prisma.user.create({
    data: {
      name: "Vendor Owner",
      email: `vendor-owner-${suffix}@example.com`,
      passwordHash: "hashed",
      role: "VENDOR"
    }
  });

  const vendor = await prisma.vendor.create({
    data: {
      name: "Baeckerei Test",
      type: "BAECKER",
      address: "Testweg 1",
      cutoffTime: "04:00",
      ownerUserId: vendorUser.id
    }
  });

  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      name: "Brot",
      category: "BROT",
      price: 2.5,
      unit: "Stk"
    }
  });

  const company = await prisma.company.create({
    data: {
      name: "Firma Nord",
      code: `FIRMA-${suffix}`
    }
  });

  await prisma.vendorCompany.create({
    data: {
      vendorId: vendor.id,
      companyId: company.id,
      status: "APPROVED",
      approvedAt: new Date()
    }
  });

  const employee = await prisma.user.create({
    data: {
      name: "Mitarbeiter A",
      email: `employee-${suffix}@example.com`,
      passwordHash: "hashed",
      role: "CUSTOMER",
      customerType: "EMPLOYEE",
      companyId: company.id
    }
  });

  const createdAt = DateTime.fromISO("2026-04-10", { zone: "Europe/Berlin" }).toUTC().toJSDate();

  await prisma.order.create({
    data: {
      userId: employee.id,
      vendorId: vendor.id,
      pickupWindow: "06:00-09:00",
      createdAt,
      items: {
        create: [{ productId: product.id, qty: 2, unitPrice: product.price }]
      }
    }
  });

  return { vendorUser, vendor, company };
};

describe("Vendor invoice sending", () => {
  it("creates one stored company invoice with pdf", async () => {
    const { vendorUser, vendor, company } = await createInvoiceFixture();
    const token = signToken({ userId: vendorUser.id, role: "VENDOR", vendorId: vendor.id });

    const response = await request(app)
      .post("/orders/vendor/invoices/send")
      .set("Authorization", `Bearer ${token}`)
      .send({ month: "2026-04", companyId: company.id })
      .expect(201);

    expect(response.body.companyId).toBe(company.id);
    expect(response.body.month).toBe("2026-04");

    const invoice = await prisma.companyInvoice.findUnique({ where: { id: response.body.id } });
    expect(invoice).not.toBeNull();

    const absolutePath = path.resolve(process.cwd(), "apps/api/uploads/company-invoices", invoice!.pdfPath);
    expect(fs.existsSync(absolutePath)).toBe(true);
  });

  it("returns 409 when the same month invoice is sent twice", async () => {
    const { vendorUser, vendor, company } = await createInvoiceFixture();
    const token = signToken({ userId: vendorUser.id, role: "VENDOR", vendorId: vendor.id });

    await request(app)
      .post("/orders/vendor/invoices/send")
      .set("Authorization", `Bearer ${token}`)
      .send({ month: "2026-04", companyId: company.id })
      .expect(201);

    await request(app)
      .post("/orders/vendor/invoices/send")
      .set("Authorization", `Bearer ${token}`)
      .send({ month: "2026-04", companyId: company.id })
      .expect(409);
  });

  it("enforces invoice download access and company visibility", async () => {
    const { vendorUser, vendor, company } = await createInvoiceFixture();

    const vendorToken = signToken({ userId: vendorUser.id, role: "VENDOR", vendorId: vendor.id });
    const sendResponse = await request(app)
      .post("/orders/vendor/invoices/send")
      .set("Authorization", `Bearer ${vendorToken}`)
      .send({ month: "2026-04", companyId: company.id })
      .expect(201);

    const invoiceId = sendResponse.body.id as string;

    const wrongVendorToken = signToken({ userId: "another-vendor-user", role: "VENDOR", vendorId: vendor.id });
    await request(app)
      .get(`/orders/vendor/invoices/${invoiceId}/download`)
      .set("Authorization", `Bearer ${wrongVendorToken}`)
      .expect(403);

    const companyToken = signToken({ userId: "company-admin", role: "COMPANY", companyId: company.id });
    await request(app)
      .get(`/orders/vendor/invoices/${invoiceId}/download`)
      .set("Authorization", `Bearer ${companyToken}`)
      .expect(200)
      .expect("Content-Type", /application\/pdf/);

    const otherCompany = await prisma.company.create({
      data: {
        name: "Firma Sued",
        code: `FIRMA-ALT-${Date.now()}`
      }
    });

    const otherCompanyToken = signToken({ userId: "other-company-admin", role: "COMPANY", companyId: otherCompany.id });

    await request(app)
      .get(`/orders/vendor/invoices/${invoiceId}/download`)
      .set("Authorization", `Bearer ${otherCompanyToken}`)
      .expect(403);

    const ownList = await request(app)
      .get("/company/invoices/received?month=2026-04")
      .set("Authorization", `Bearer ${companyToken}`)
      .expect(200);

    const otherList = await request(app)
      .get("/company/invoices/received?month=2026-04")
      .set("Authorization", `Bearer ${otherCompanyToken}`)
      .expect(200);

    expect(ownList.body).toHaveLength(1);
    expect(otherList.body).toHaveLength(0);
  });
});
