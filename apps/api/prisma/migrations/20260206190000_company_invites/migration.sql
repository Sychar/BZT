-- Create CompanyInvite table
CREATE TABLE IF NOT EXISTS "CompanyInvite" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyInvite_pkey" PRIMARY KEY ("id")
);

-- Unique code for invite
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyInvite_code_key" ON "CompanyInvite"("code");

-- Add foreign keys
ALTER TABLE "CompanyInvite"
ADD CONSTRAINT "CompanyInvite_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyInvite"
ADD CONSTRAINT "CompanyInvite_usedByUserId_fkey"
FOREIGN KEY ("usedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "CompanyInvite_companyId_idx" ON "CompanyInvite"("companyId");
