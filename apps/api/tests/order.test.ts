import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/prisma";
import { createCustomer, createVendorWithProduct, signToken } from "./helpers";

describe("Orders", () => {
  it("creates an order with items", async () => {
    const customer = await createCustomer();
    const { vendor, product } = await createVendorWithProduct();

    const token = signToken({ userId: customer.id, role: "CUSTOMER" });

    const response = await request(app)
      .post("/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        vendorId: vendor.id,
        pickupWindow: "06:00-09:00",
        note: "Bitte schneiden",
        items: [{ productId: product.id, qty: 2, itemNote: "dunkel" }]
      })
      .expect(201);

    expect(response.body.vendorId).toBe(vendor.id);
    expect(response.body.items).toHaveLength(1);

    const stored = await prisma.order.findUnique({
      where: { id: response.body.id },
      include: { items: true }
    });

    expect(stored).not.toBeNull();
    expect(stored?.items[0]?.qty).toBe(2);
  });
});
