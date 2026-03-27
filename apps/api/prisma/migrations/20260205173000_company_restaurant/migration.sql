-- Add enum values and new enums
ALTER TYPE "VendorType" ADD VALUE IF NOT EXISTS 'RESTAURANT';

CREATE TYPE "CustomerType" AS ENUM ('EMPLOYEE', 'PRIVATE');
CREATE TYPE "VendorVisibility" AS ENUM ('PUBLIC', 'COMPANY_ONLY');
CREATE TYPE "VendorPartnership" AS ENUM ('PARTNER', 'AD_ONLY');
CREATE TYPE "ReservationStatus" AS ENUM ('ANGEFRAGT', 'BESTAETIGT', 'STORNIERT');

-- Company table
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- Extend User
ALTER TABLE "User"
ADD COLUMN "customerType" "CustomerType",
ADD COLUMN "companyId" TEXT;

-- Extend Vendor
ALTER TABLE "Vendor"
ADD COLUMN "visibility" "VendorVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN "partnership" "VendorPartnership" NOT NULL DEFAULT 'PARTNER',
ADD COLUMN "companyId" TEXT,
ADD COLUMN "supportsReservations" BOOLEAN NOT NULL DEFAULT false;

-- Daily menus and items
CREATE TABLE "DailyMenu" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMenu_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyMenuItem" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DailyMenuItem_pkey" PRIMARY KEY ("id")
);

-- Restaurant orders
CREATE TABLE "RestaurantOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "pickupTime" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'EINGEGANGEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "itemNote" TEXT,

    CONSTRAINT "RestaurantOrderItem_pkey" PRIMARY KEY ("id")
);

-- Reservations
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "reservationTime" TIMESTAMP(3) NOT NULL,
    "partySize" INTEGER NOT NULL,
    "note" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ANGEFRAGT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- FKs
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DailyMenu" ADD CONSTRAINT "DailyMenu_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyMenuItem" ADD CONSTRAINT "DailyMenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "DailyMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "DailyMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
