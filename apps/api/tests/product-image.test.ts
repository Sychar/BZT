import path from "path";
import fs from "fs";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/prisma";
import { signToken } from "./helpers";

describe("Product image upload", () => {
  it("allows only owner vendor and supports image removal", async () => {
    const suffix = Date.now().toString();

    const vendorOwner = await prisma.user.create({
      data: {
        name: "Owner",
        email: `owner-${suffix}@example.com`,
        passwordHash: "hashed",
        role: "VENDOR"
      }
    });

    const vendor = await prisma.vendor.create({
      data: {
        name: "Image Vendor",
        type: "BAECKER",
        address: "Bildweg 2",
        cutoffTime: "04:00",
        ownerUserId: vendorOwner.id
      }
    });

    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        name: "Croissant",
        category: "BROT",
        price: 1.9,
        unit: "Stk"
      }
    });

    const ownerToken = signToken({ userId: vendorOwner.id, role: "VENDOR", vendorId: vendor.id });

    const uploadResponse = await request(app)
      .post(`/vendor/products/${product.id}/image`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .attach("file", Buffer.from("fake-png-content"), "produkt.png")
      .expect(201);

    expect(uploadResponse.body.imageUrl).toMatch(/^\/product-images\//);

    const uploadedPath = path.resolve(
      process.cwd(),
      "apps/api/uploads/product-images",
      path.basename(uploadResponse.body.imageUrl)
    );
    expect(fs.existsSync(uploadedPath)).toBe(true);

    const outsiderToken = signToken({ userId: "outsider", role: "VENDOR", vendorId: vendor.id });
    await request(app)
      .post(`/vendor/products/${product.id}/image`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .attach("file", Buffer.from("fake-png-content"), "produkt.png")
      .expect(403);

    const removeResponse = await request(app)
      .put(`/products/${product.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ imageUrl: null })
      .expect(200);

    expect(removeResponse.body.imageUrl).toBeNull();
    expect(fs.existsSync(uploadedPath)).toBe(false);
  });
});
