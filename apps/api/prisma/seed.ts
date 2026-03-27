import bcrypt from "bcryptjs";
import { DateTime } from "luxon";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const run = async () => {
  await prisma.restaurantOrderItem.deleteMany();
  await prisma.restaurantOrder.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.dailyMenuItem.deleteMany();
  await prisma.dailyMenu.deleteMany();
  await prisma.dailyBatchOrder.deleteMany();
  await prisma.dailyBatchItem.deleteMany();
  await prisma.dailyBatch.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.vendorCompany.deleteMany();
  await prisma.companyInvite.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const passwordHash = await bcrypt.hash("Password123", 10);

  const company = await prisma.company.create({
    data: {
      name: "Firma XY",
      code: "FIRMA-XY",
      isActive: true,
      activatedAt: new Date()
    }
  });

  const neutralAdmin = await prisma.user.create({
    data: {
      name: "Plattform Admin",
      email: "admin@example.com",
      passwordHash,
      role: "COMPANY"
    }
  });

  const companyAdmin = await prisma.user.create({
    data: {
      name: "Firma Admin",
      email: "firma@example.com",
      passwordHash,
      role: "COMPANY",
      companyId: company.id
    }
  });

  const employee = await prisma.user.create({
    data: {
      name: "Mitarbeiter Mia",
      email: "mitarbeiter@example.com",
      passwordHash,
      role: "CUSTOMER",
      customerType: "EMPLOYEE",
      companyId: company.id
    }
  });

  const bakerUser = await prisma.user.create({
    data: {
      name: "Baeckerin Anna",
      email: "baecker@example.com",
      passwordHash,
      role: "VENDOR"
    }
  });

  const butcherUser = await prisma.user.create({
    data: {
      name: "Metzger Paul",
      email: "metzger@example.com",
      passwordHash,
      role: "VENDOR"
    }
  });

  const baker = await prisma.vendor.create({
    data: {
      name: "Baeckerei Sonnensemme",
      type: "BAECKER",
      address: "Hauptstrasse 12, 10115 Berlin",
      cutoffTime: "04:00",
      visibility: "COMPANY_ONLY",
      partnership: "PARTNER",
      ownerUserId: bakerUser.id
    }
  });

  const butcher = await prisma.vendor.create({
    data: {
      name: "Metzgerei Herzhaft",
      type: "METZGER",
      address: "Marktweg 7, 10115 Berlin",
      cutoffTime: "04:00",
      visibility: "PUBLIC",
      partnership: "PARTNER",
      ownerUserId: butcherUser.id
    }
  });

  // Firmen-Verbindung wird jetzt manuell im Testflow erstellt

  const restaurantPartner = await prisma.vendor.create({
    data: {
      name: "Pizza RAI",
      type: "RESTAURANT",
      address: "Seestrasse 22, 10115 Berlin",
      cutoffTime: "04:00",
      visibility: "PUBLIC",
      partnership: "PARTNER",
      supportsReservations: true
    }
  });

  const restaurantAd = await prisma.vendor.create({
    data: {
      name: "Indien Express",
      type: "RESTAURANT",
      address: "Ringstrasse 9, 10115 Berlin",
      cutoffTime: "04:00",
      visibility: "PUBLIC",
      partnership: "AD_ONLY",
      supportsReservations: false
    }
  });

  await prisma.product.createMany({
    data: [
      {
        vendorId: baker.id,
        name: "Bauernbrot",
        category: "BROT",
        price: 3.9,
        unit: "Stk"
      },
      {
        vendorId: baker.id,
        name: "Vollkornbrot",
        category: "BROT",
        price: 4.2,
        unit: "Stk"
      },
      {
        vendorId: baker.id,
        name: "Croissant",
        category: "BROT",
        price: 1.8,
        unit: "Stk",
        isPromo: true
      },
      {
        vendorId: baker.id,
        name: "Butter",
        category: "BELAG",
        price: 1.2,
        unit: "Port"
      },
      {
        vendorId: baker.id,
        name: "Kaffee",
        category: "GETRAENK",
        price: 2.4,
        unit: "Becher"
      },
      {
        vendorId: baker.id,
        name: "Orangensaft",
        category: "GETRAENK",
        price: 2.9,
        unit: "Flasche"
      },
      {
        vendorId: butcher.id,
        name: "Leberkaese",
        category: "FLEISCH",
        price: 3.5,
        unit: "100g"
      },
      {
        vendorId: butcher.id,
        name: "Putenbrust",
        category: "FLEISCH",
        price: 4.1,
        unit: "100g"
      },
      {
        vendorId: butcher.id,
        name: "Salami",
        category: "WURST",
        price: 2.9,
        unit: "100g"
      },
      {
        vendorId: butcher.id,
        name: "Leberwurst",
        category: "WURST",
        price: 2.4,
        unit: "100g",
        isPromo: true
      }
    ]
  });

  const today = DateTime.now().setZone("Europe/Berlin").startOf("day").toUTC().toJSDate();

  const menu1 = await prisma.dailyMenu.create({
    data: {
      vendorId: restaurantPartner.id,
      date: today,
      title: "Mittagstisch",
      description: "Pizza + Salat Kombi",
      items: {
        create: [
          { name: "Pizza Margherita", price: 9.99 },
          { name: "Pizza Salami", price: 10.99 },
          { name: "Beilagensalat", price: 3.5 }
        ]
      }
    }
  });

  const menu2 = await prisma.dailyMenu.create({
    data: {
      vendorId: restaurantPartner.id,
      date: today,
      title: "Pasta Special",
      description: "Frisch aus der K?che",
      items: {
        create: [
          { name: "Penne Arrabiata", price: 8.9 },
          { name: "Lasagne", price: 11.5 }
        ]
      }
    }
  });

  await prisma.dailyMenu.create({
    data: {
      vendorId: restaurantAd.id,
      date: today,
      title: "Indisches Men?",
      description: "Reis + Brot + Curry",
      items: {
        create: [
          { name: "Chicken Curry mit Reis", price: 11.9 },
          { name: "Vegetarisches Dal", price: 9.9 },
          { name: "Naan Brot", price: 2.5 }
        ]
      }
    }
  });

  console.log("Seed completed", {
    neutralAdminId: neutralAdmin.id,
    companyId: company.id,
    companyAdminId: companyAdmin.id,
    employeeId: employee.id,
    bakerId: baker.id,
    butcherId: butcher.id,
    restaurantPartnerId: restaurantPartner.id,
    restaurantAdId: restaurantAd.id,
    menuIds: [menu1.id, menu2.id]
  });
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
