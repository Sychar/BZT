import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/prisma";

describe("Registration requests", () => {
  it("creates a company registration request", async () => {
    const response = await request(app)
      .post("/auth/registration-request")
      .send({
        requestType: "COMPANY",
        businessName: "Firma Test GmbH",
        contactName: "Max Mustermann",
        email: "max@example.com",
        phone: "+49 151 12345678",
        address: "Musterstrasse 12, 88171 Weiler"
      })
      .expect(201);

    expect(response.body.id).toBeTruthy();
    expect(response.body.status).toBe("NEW");

    const stored = await prisma.registrationRequest.findUnique({
      where: { id: response.body.id }
    });
    expect(stored).not.toBeNull();
    expect(stored?.requestType).toBe("COMPANY");
    expect(stored?.vendorType).toBeNull();
  });

  it("requires vendor type for vendor requests", async () => {
    await request(app)
      .post("/auth/registration-request")
      .send({
        requestType: "VENDOR",
        businessName: "Baeckerei Test",
        contactName: "Anna Beispiel",
        email: "anna@example.com",
        phone: "+49 151 11111111",
        address: "Hauptstrasse 1, 88171 Weiler"
      })
      .expect(400);
  });
});
