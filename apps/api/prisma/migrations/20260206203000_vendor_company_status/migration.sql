DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VendorCompanyStatus') THEN
        CREATE TYPE "VendorCompanyStatus" AS ENUM ('PENDING', 'APPROVED');
    END IF;
END $$;

ALTER TABLE "VendorCompany"
ADD COLUMN IF NOT EXISTS "status" "VendorCompanyStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE "VendorCompany"
ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "VendorCompany"
ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

-- Existing links should be active
UPDATE "VendorCompany" SET "status" = 'APPROVED' WHERE "status" = 'PENDING';
