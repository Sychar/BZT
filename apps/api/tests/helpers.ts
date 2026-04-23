import jwt from "jsonwebtoken";
import { prisma } from "../src/prisma";

export const signToken = (payload: {
  userId: string;
  role: "CUSTOMER" | "VENDOR" | "COMPANY";
  vendorId?: string | null;
  companyId?: string | null;
  customerType?: "EMPLOYEE" | "PRIVATE" | null;
}) => {
  const secret = process.env.JWT_SECRET ?? "test-secret";
  return jwt.sign(payload, secret, { expiresIn: "1h" });
};

export const createCustomer = async () => {
  return prisma.user.create({
    data: {
      name: "Test Kunde",
      email: `kunde-${Date.now()}@example.com`,
      passwordHash: "hashed",
      role: "CUSTOMER"
    }
  });
};

export const createVendorWithProduct = async () => {
  const vendorUser = await prisma.user.create({
    data: {
      name: "Vendor Owner",
      email: `vendor-${Date.now()}@example.com`,
      passwordHash: "hashed",
      role: "VENDOR"
    }
  });
  const vendor = await prisma.vendor.create({
    data: {
      name: "Test Anbieter",
      type: "BAECKER",
      address: "Testweg 1",
      cutoffTime: "04:00",
      ownerUserId: vendorUser.id
    }
  });
  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      name: "Testprodukt",
      category: "BROT",
      price: 2.5,
      unit: "Stk"
    }
  });
  return { vendorUser, vendor, product };
};
