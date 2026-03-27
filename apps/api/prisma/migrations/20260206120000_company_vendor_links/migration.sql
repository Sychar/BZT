-- Add COMPANY role
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COMPANY';

-- Extend Company
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);

-- Create VendorCompany join table
CREATE TABLE IF NOT EXISTS "VendorCompany" (
    "vendorId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorCompany_pkey" PRIMARY KEY ("vendorId", "companyId")
);

-- Migrate existing vendor company links
INSERT INTO "VendorCompany" ("vendorId", "companyId")
SELECT "id", "companyId" FROM "Vendor" WHERE "companyId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop old vendor company relation
ALTER TABLE "Vendor" DROP CONSTRAINT IF EXISTS "Vendor_companyId_fkey";
ALTER TABLE "Vendor" DROP COLUMN IF EXISTS "companyId";

-- Add foreign keys for VendorCompany
ALTER TABLE "VendorCompany" ADD CONSTRAINT "VendorCompany_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VendorCompany" ADD CONSTRAINT "VendorCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
