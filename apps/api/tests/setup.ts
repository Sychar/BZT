import { prisma } from "../src/prisma";

const truncateAll = async () => {
  await prisma.dailyBatchOrder.deleteMany();
  await prisma.dailyBatchItem.deleteMany();
  await prisma.dailyBatch.deleteMany();
  await prisma.restaurantOrderItem.deleteMany();
  await prisma.restaurantOrder.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.dailyMenuItem.deleteMany();
  await prisma.dailyMenu.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.companyInvoice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.vendorCompany.deleteMany();
  await prisma.companyInvite.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
};

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await truncateAll();
  await prisma.$disconnect();
});
